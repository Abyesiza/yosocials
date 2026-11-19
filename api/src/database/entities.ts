import { SocialAccount } from '../modules/accounts/entities/social-account.entity.js';
import { PostMetricSnapshot } from '../modules/analytics/entities/post-metric-snapshot.entity.js';
import { PostTarget } from '../modules/posts/entities/post-target.entity.js';
import { Post } from '../modules/posts/entities/post.entity.js';

/** Every entity, shared by the app and the migration CLI. */
export const ENTITIES = [SocialAccount, Post, PostTarget, PostMetricSnapshot];
