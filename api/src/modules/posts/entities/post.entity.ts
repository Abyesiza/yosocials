import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  type Relation,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { Workspace } from '../../workspaces/entities/workspace.entity.js';
import { PostSource } from '../enums/post-status.enum.js';
import { PostTarget } from './post-target.entity.js';

/**
 * One piece of content. It is published to one or more accounts through its
 * targets, each of which can have its own text and time.
 */
@Entity('posts')
@Index(['workspaceId', 'createdAt'])
export class Post extends BaseEntity {
  @Column('uuid')
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Relation<Workspace>;

  /** Who created it; null for agent output or if the user was deleted. */
  @Column({ type: 'uuid', nullable: true })
  createdById: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy: Relation<User> | null;

  /** Internal label for the calendar, never published. */
  @Column({ type: 'varchar', length: 200, nullable: true })
  title: string | null;

  /** Default text for every target that doesn't override it. */
  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'enum', enum: PostSource, default: PostSource.Manual })
  source: PostSource;

  @OneToMany(() => PostTarget, (target) => target.post, { cascade: true })
  targets: PostTarget[];
}
