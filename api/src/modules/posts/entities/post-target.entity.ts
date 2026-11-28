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
import { SocialAccount } from '../../accounts/entities/social-account.entity.js';
import { TargetStatus } from '../enums/post-status.enum.js';
import { Post } from './post.entity.js';

/**
 * A post on one specific account: its own text variant, schedule, publish
 * result and latest engagement numbers. The unified feed and the calendar
 * are both views over this table.
 */
@Entity('post_targets')
@Unique(['postId', 'accountId'])
@Index(['status', 'scheduledAt'])
@Index(['publishedAt'])
export class PostTarget extends BaseEntity {
  @Column('uuid')
  postId: string;

  @ManyToOne(() => Post, (post) => post.targets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post: Relation<Post>;

  @Column('uuid')
  accountId: string;

  @ManyToOne(() => SocialAccount, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'accountId' })
  account: Relation<SocialAccount>;

  /** Platform-specific text. `null` means use the post's body. */
  @Column({ type: 'text', nullable: true })
  text: string | null;

  /** Platform-specific settings (e.g. TikTok privacy), validated by the provider. */
  @Column({ type: 'jsonb', nullable: true })
  options: Record<string, unknown> | null;

  @Column({ type: 'enum', enum: TargetStatus, default: TargetStatus.Draft })
  status: TargetStatus;

  @Column({ type: 'timestamptz', nullable: true })
  scheduledAt: Date | null;

  /** Why Aby Socials picked `scheduledAt`; cleared when a person sets the time. */
  @Column({ type: 'text', nullable: true })
  scheduleReason: string | null;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @Column({ type: 'text', nullable: true })
  externalId: string | null;

  @Column({ type: 'text', nullable: true })
  externalUrl: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  // Latest engagement, denormalised from metric snapshots for fast feeds.
  @Column({ type: 'int', nullable: true }) likes: number | null;
  @Column({ type: 'int', nullable: true }) reposts: number | null;
  @Column({ type: 'int', nullable: true }) replies: number | null;
  @Column({ type: 'int', nullable: true }) quotes: number | null;
  @Column({ type: 'int', nullable: true }) views: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  metricsUpdatedAt: Date | null;

  /** The text that actually gets published. */
  effectiveText(post: Post = this.post): string {
    return this.text ?? post.body;
  }
}
