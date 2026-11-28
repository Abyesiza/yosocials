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
import type { Platform } from '../../../common/enums/platform.enum.js';
import type { MediaKind } from '../../integrations/interfaces/platform-provider.interface.js';
import { User } from '../../users/entities/user.entity.js';
import { Workspace } from '../../workspaces/entities/workspace.entity.js';
import { PostSource } from '../enums/post-status.enum.js';
import { PostTarget } from './post-target.entity.js';

/**
 * One piece of content. It is published to one or more accounts through its
 * targets, each of which can have its own text and time.
 */
/** One stored file: the original, or a copy prepared for a platform. */
export interface MediaFile {
  /** UploadThing custom id: `<workspaceId>_<uuid>.<ext>`. */
  path: string;
  contentType: string;
  size: number;
  /** Measured in the browser; null on media attached before they were recorded. */
  width?: number | null;
  height?: number | null;
}

/** A copy of a media item sized and framed for one platform. */
export interface MediaVariant extends MediaFile {
  platform: Platform;
}

/**
 * An uploaded file attached to a post. Platforms that can't take the original
 * as it is get their own copy in `variants` (shared paths where they need
 * the same one).
 */
export interface PostMedia extends MediaFile {
  kind: MediaKind;
  /** Reported by the browser for videos; platforms with length limits check it. */
  durationSec?: number | null;
  variants?: MediaVariant[];
}

/** The file a platform gets for this item: its own copy, or the original. */
export function mediaFor(media: PostMedia, platform: Platform): MediaFile {
  return media.variants?.find((v) => v.platform === platform) ?? media;
}

/** Every stored file of these items, originals and copies, once each. */
export function mediaPaths(media: PostMedia[]): string[] {
  return [
    ...new Set(
      media.flatMap((m) => [m.path, ...(m.variants ?? []).map((v) => v.path)]),
    ),
  ];
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
