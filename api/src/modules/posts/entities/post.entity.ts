import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity.js';
import { PostSource } from '../enums/post-status.enum.js';
import { PostTarget } from './post-target.entity.js';

/**
 * One piece of content. It is published to one or more accounts through its
 * targets, each of which can have its own text and time.
 */
@Entity('posts')
export class Post extends BaseEntity {
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
