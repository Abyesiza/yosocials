import { SocialAccount } from '../modules/accounts/entities/social-account.entity.js';
import { PostMetricSnapshot } from '../modules/analytics/entities/post-metric-snapshot.entity.js';
import { RefreshToken } from '../modules/auth/entities/refresh-token.entity.js';
import { RevokedTokenFamily } from '../modules/auth/entities/revoked-token-family.entity.js';
import { ProviderSession } from '../modules/integrations/entities/provider-session.entity.js';
import { PostTarget } from '../modules/posts/entities/post-target.entity.js';
import { Post } from '../modules/posts/entities/post.entity.js';
import { User } from '../modules/users/entities/user.entity.js';
import { WorkspaceMember } from '../modules/workspaces/entities/workspace-member.entity.js';
import { Workspace } from '../modules/workspaces/entities/workspace.entity.js';

/** Every entity, shared by the app and the migration CLI. */
export const ENTITIES = [
  User,
  Workspace,
  WorkspaceMember,
  RefreshToken,
  RevokedTokenFamily,
  SocialAccount,
  Post,
  PostTarget,
  PostMetricSnapshot,
  ProviderSession,
];
