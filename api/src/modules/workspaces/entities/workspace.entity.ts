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

  /** Where most of the audience lives (ISO 3166-1 alpha-2), for planning. */
  @Column({ type: 'varchar', length: 2, nullable: true })
  audienceCountry: string | null;

  /** The audience's IANA time zone: posting windows and suggested times use it. Null until set. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  audienceTimeZone: string | null;

  @OneToMany(() => WorkspaceMember, (m) => m.workspace)
  members: WorkspaceMember[];
}
