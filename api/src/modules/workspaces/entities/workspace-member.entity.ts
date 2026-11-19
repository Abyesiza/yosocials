import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
  type Relation,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { WorkspaceRole } from '../enums/workspace-role.enum.js';
import { Workspace } from './workspace.entity.js';

@Entity('workspace_members')
@Unique(['workspaceId', 'userId'])
@Index(['userId'])
export class WorkspaceMember extends BaseEntity {
  @Column('uuid')
  workspaceId: string;

  @ManyToOne(() => Workspace, (w) => w.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Relation<Workspace>;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @Column({ type: 'enum', enum: WorkspaceRole })
  role: WorkspaceRole;
}
