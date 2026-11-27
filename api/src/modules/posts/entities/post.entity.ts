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
import type { MediaKind } from '../../integrations/interfaces/platform-provider.interface.js';
import { User } from '../../users/entities/user.entity.js';
import { Workspace } from '../../workspaces/entities/workspace.entity.js';
import { PostSource } from '../enums/post-status.enum.js';
import { PostTarget } from './post-target.entity.js';

/**
 * One piece of content. It is published to one or more accounts through its
 * targets, each of which can have its own text and time.
 */
/** An uploaded file attached to a post, stored in the media bucket. */
export interface PostMedia {
  /** Object path in the bucket: `<workspaceId>/<uuid>.<ext>`. */
  path: string;
  kind: MediaKind;
  contentType: string;
  size: number;
  /** Reported by the browser for videos; platforms with length limits check it. */
  durationSec?: number | null;
}

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

  /** Shared by every target; text-only platforms ignore it. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  media: PostMedia[];

  @Column({ type: 'enum', enum: PostSource, default: PostSource.Manual })
  source: PostSource;

  @OneToMany(() => PostTarget, (target) => target.post, { cascade: true })
  targets: PostTarget[];
}
