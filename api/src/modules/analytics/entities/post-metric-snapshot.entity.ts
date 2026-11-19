import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PostTarget } from '../../posts/entities/post-target.entity.js';

/**
 * Engagement numbers for one published target at one point in time. A series
 * of these shows how a post "moved" after publishing.
 */
@Entity('post_metric_snapshots')
@Index(['targetId', 'capturedAt'])
export class PostMetricSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  targetId: string;

  @ManyToOne(() => PostTarget, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'targetId' })
  target: PostTarget;

  @CreateDateColumn({ type: 'timestamptz' })
  capturedAt: Date;

  @Column({ type: 'int', nullable: true }) likes: number | null;
  @Column({ type: 'int', nullable: true }) reposts: number | null;
  @Column({ type: 'int', nullable: true }) replies: number | null;
  @Column({ type: 'int', nullable: true }) quotes: number | null;
  @Column({ type: 'int', nullable: true }) views: number | null;

  @Column({ type: 'jsonb', default: {} })
  raw: Record<string, unknown>;
}
