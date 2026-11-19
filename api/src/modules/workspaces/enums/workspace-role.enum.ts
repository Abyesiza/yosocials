/**
 * What a member can do in a workspace. Each role includes everything the
 * roles below it can do.
 */
export enum WorkspaceRole {
  /** Everything, including deleting the workspace and managing admins. */
  Owner = 'owner',
  /** Connect/remove social accounts, manage members, edit the workspace. */
  Admin = 'admin',
  /** Create, edit, schedule and publish posts; use the agent. */
  Editor = 'editor',
  /** Read-only: feed, calendar, analytics. */
  Viewer = 'viewer',
}

const RANK: Record<WorkspaceRole, number> = {
  [WorkspaceRole.Viewer]: 0,
  [WorkspaceRole.Editor]: 1,
  [WorkspaceRole.Admin]: 2,
  [WorkspaceRole.Owner]: 3,
};

export function hasRole(
  actual: WorkspaceRole,
  required: WorkspaceRole,
): boolean {
  return RANK[actual] >= RANK[required];
}
