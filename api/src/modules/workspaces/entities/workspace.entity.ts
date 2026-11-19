import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity.js';
import { WorkspaceMember } from './workspace-member.entity.js';

/**
 * The unit of ownership: social accounts, posts and analytics all belong to
 * a workspace, and people get access through membership.
 */
@Entity('workspaces')
export class Workspace extends BaseEntity {
  @Column({ type: 'varchar', length: 120 })
  name: string;

  @OneToMany(() => WorkspaceMember, (m) => m.workspace)
  members: WorkspaceMember[];
}
