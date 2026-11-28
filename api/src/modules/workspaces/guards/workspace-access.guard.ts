import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isUUID } from 'class-validator';
import { REQUIRED_ROLE } from '../workspace.constants.js';
import { hasRole, WorkspaceRole } from '../enums/workspace-role.enum.js';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContext,
} from '../interfaces/workspace-context.interface.js';
import { WorkspacesService } from '../workspaces.service.js';

/**
 * Runs after the global authentication guard. Loads the caller's membership
 * of `:workspaceId` and checks it against the route's RequireRole.
 *
 * Non-members get 404 rather than 403, so workspace ids can't be probed.
 */
@Injectable()
export class WorkspaceAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly workspaces: WorkspacesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      params: Record<string, string>;
      /** Set by the global AuthenticationGuard, which runs first. */
      user?: { id: string } | null;
      [WORKSPACE_CONTEXT]?: WorkspaceContext;
    }>();
    const workspaceId = request.params.workspaceId;
    if (!workspaceId || !isUUID(workspaceId)) {
      throw new NotFoundException(
        'We couldn’t find that workspace, or you’re not a member.',
      );
    }

    // AuthenticationContext only opens around the handler (it's an
    // interceptor), so guards read the user the auth guard put on the request.
    const user = request.user;
    if (!user) throw new UnauthorizedException('Log in to continue.');
    const membership = await this.workspaces.findMembership(
      workspaceId,
      user.id,
    );
    if (!membership)
      throw new NotFoundException(
        'We couldn’t find that workspace, or you’re not a member.',
      );

    const required =
      this.reflector.getAllAndOverride<WorkspaceRole | undefined>(
        REQUIRED_ROLE,
        [context.getHandler(), context.getClass()],
      ) ?? WorkspaceRole.Viewer;
    if (!hasRole(membership.role, required)) {
      throw new ForbiddenException(
        `You need the ${required} role in this workspace to do that. Ask a workspace admin.`,
      );
    }

    request[WORKSPACE_CONTEXT] = {
      workspaceId,
      userId: user.id,
      role: membership.role,
    };
    return true;
  }
}
