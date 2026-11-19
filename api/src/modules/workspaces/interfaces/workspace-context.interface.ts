import type { WorkspaceRole } from '../enums/workspace-role.enum.js';

/**
 * Who is acting in which workspace, resolved by WorkspaceAccessGuard from the
 * `:workspaceId` route param and the signed-in user.
 */
export interface WorkspaceContext {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}

/** Where the guard leaves the context on the request. */
export const WORKSPACE_CONTEXT = Symbol('workspaceContext');
