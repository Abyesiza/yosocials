import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, Repository } from 'typeorm';
import { MediaStorageService } from '../../common/storage/media-storage.service.js';
import { UsersService } from '../users/users.service.js';
import type {
  AddMemberDto,
  CreateWorkspaceDto,
  UpdateMemberDto,
  UpdateWorkspaceDto,
} from './dto/workspace.dto.js';
import { WorkspaceMember } from './entities/workspace-member.entity.js';
import { Workspace } from './entities/workspace.entity.js';
import { hasRole, WorkspaceRole } from './enums/workspace-role.enum.js';
import type { WorkspaceContext } from './interfaces/workspace-context.interface.js';

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Workspace)
    private readonly workspaces: Repository<Workspace>,
    @InjectRepository(WorkspaceMember)
    private readonly members: Repository<WorkspaceMember>,
    private readonly users: UsersService,
    private readonly storage: MediaStorageService,
  ) {}

  /** Creates a workspace owned by `userId`, inside the caller's transaction. */
  async createOwned(
    manager: EntityManager,
    userId: string,
    name: string,
  ): Promise<Workspace> {
    const workspace = await manager.save(manager.create(Workspace, { name }));
    await manager.save(
      manager.create(WorkspaceMember, {
        workspaceId: workspace.id,
        userId,
        role: WorkspaceRole.Owner,
      }),
    );
    return workspace;
  }

  create(userId: string, dto: CreateWorkspaceDto): Promise<Workspace> {
    return this.dataSource.transaction((m) =>
      this.createOwned(m, userId, dto.name),
    );
  }

  /** Every workspace the user belongs to, with their role in it. */
  listForUser(userId: string): Promise<WorkspaceMember[]> {
    return this.members.find({
      where: { userId },
      relations: { workspace: true },
      order: { createdAt: 'ASC' },
    });
  }

  findMembership(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember | null> {
    return this.members.findOneBy({ workspaceId, userId });
  }

  async get(workspaceId: string): Promise<Workspace> {
    const workspace = await this.workspaces.findOneBy({ id: workspaceId });
    if (!workspace)
      throw new NotFoundException(
        'We couldn’t find that workspace, or you’re not a member.',
      );
    return workspace;
  }

  /** Renames the workspace and sets its audience; absent fields are kept. */
  async update(
    workspaceId: string,
    dto: UpdateWorkspaceDto,
  ): Promise<Workspace> {
    const changes = {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.audienceCountry !== undefined && {
        audienceCountry: dto.audienceCountry,
      }),
      ...(dto.audienceTimeZone !== undefined && {
        audienceTimeZone: dto.audienceTimeZone,
      }),
    };
    if (Object.keys(changes).length > 0) {
      await this.workspaces.update(workspaceId, changes);
    }
    return this.get(workspaceId);
  }

  /** Deletes the workspace and, through cascades, its accounts and posts. */
  async remove(workspaceId: string): Promise<void> {
    const media: { path: string }[] = await this.dataSource.query(
      `SELECT jsonb_array_elements(media)->>'path' AS path FROM posts WHERE "workspaceId" = $1`,
      [workspaceId],
    );
    await this.workspaces.delete(workspaceId);
    await this.storage.remove(media.map((m) => m.path));
  }

  listMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    return this.members.find({
      where: { workspaceId },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });
  }

  /** Adds an existing user by email. They need an account first. */
  async addMember(
    ctx: WorkspaceContext,
    dto: AddMemberDto,
  ): Promise<WorkspaceMember> {
    this.assertCanAssign(ctx, dto.role);
    const user = await this.users.findByEmail(dto.email);
    if (!user) {
      throw new NotFoundException(
        'No Aby Socials account uses that email. Ask them to sign up first.',
      );
    }
    if (
      await this.members.existsBy({
        workspaceId: ctx.workspaceId,
        userId: user.id,
      })
    ) {
      throw new ConflictException(
        'That person is already a member of this workspace.',
      );
    }
    await this.members.save(
      this.members.create({
        workspaceId: ctx.workspaceId,
        userId: user.id,
        role: dto.role,
      }),
    );
    return this.getMember(ctx.workspaceId, user.id);
  }

  async updateMember(
    ctx: WorkspaceContext,
    userId: string,
    dto: UpdateMemberDto,
  ): Promise<WorkspaceMember> {
    await this.dataSource.transaction(async (m) => {
      const member = await this.lockMember(m, ctx.workspaceId, userId);
      this.assertCanManage(ctx, member);
      this.assertCanAssign(ctx, dto.role);
      if (
        member.role === WorkspaceRole.Owner &&
        dto.role !== WorkspaceRole.Owner
      ) {
        await this.assertNotLastOwner(m, ctx.workspaceId);
      }
      await m.update(WorkspaceMember, member.id, { role: dto.role });
    });
    return this.getMember(ctx.workspaceId, userId);
  }

  /** Removes a member. Anyone may remove themselves (leave). */
  async removeMember(ctx: WorkspaceContext, userId: string): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const member = await this.lockMember(m, ctx.workspaceId, userId);
      if (userId !== ctx.userId) {
        if (!hasRole(ctx.role, WorkspaceRole.Admin)) {
          throw new ForbiddenException(
            'Only workspace admins and owners can remove other members.',
          );
        }
        this.assertCanManage(ctx, member);
      }
      if (member.role === WorkspaceRole.Owner) {
        await this.assertNotLastOwner(m, ctx.workspaceId);
      }
      await m.delete(WorkspaceMember, member.id);
    });
  }

  private async getMember(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember> {
    const member = await this.members.findOne({
      where: { workspaceId, userId },
      relations: { user: true },
    });
    if (!member)
      throw new NotFoundException(
        'We couldn’t find that member in this workspace.',
      );
    return member;
  }

  /** Row-locks the member so concurrent role changes can't race. */
  private async lockMember(
    m: EntityManager,
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember> {
    const member = await m.findOne(WorkspaceMember, {
      where: { workspaceId, userId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!member)
      throw new NotFoundException(
        'We couldn’t find that member in this workspace.',
      );
    return member;
  }

  /** Locks every owner row, so two owners can't both step down at once. */
  private async assertNotLastOwner(
    m: EntityManager,
    workspaceId: string,
  ): Promise<void> {
    const owners = await m.find(WorkspaceMember, {
      where: { workspaceId, role: WorkspaceRole.Owner },
      lock: { mode: 'pessimistic_write' },
    });
    if (owners.length <= 1) {
      throw new BadRequestException(
        'A workspace needs at least one owner. Make someone else an owner first.',
      );
    }
  }

  /** Admins manage everyone below owner; only owners manage owners. */
  private assertCanManage(
    ctx: WorkspaceContext,
    target: WorkspaceMember,
  ): void {
    if (
      target.role === WorkspaceRole.Owner &&
      ctx.role !== WorkspaceRole.Owner
    ) {
      throw new ForbiddenException(
        'Only an owner can change or remove another owner.',
      );
    }
  }

  /** You can only hand out roles up to your own; owner needs owner. */
  private assertCanAssign(ctx: WorkspaceContext, role: WorkspaceRole): void {
    if (!hasRole(ctx.role, role)) {
      throw new ForbiddenException(
        'You can’t give someone a role above your own.',
      );
    }
  }
}
