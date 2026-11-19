"use client";

import { useParams } from "next/navigation";
import { createContext, use, useMemo, type ReactNode } from "react";
import { useApi } from "@/app/lib/api/client";
import type { Me, Workspace, WorkspaceRole } from "@/app/lib/api/types";

const RANK: Record<WorkspaceRole, number> = { viewer: 0, editor: 1, admin: 2, owner: 3 };

export interface WorkspaceValue {
  workspaceId: string;
  /** API path prefix: `/workspaces/:id`. */
  base: string;
  href: (path?: string) => string;
  me?: Me;
  workspace?: Workspace;
  loading: boolean;
  /** Not a member (or the workspace is gone), known only after loading. */
  missing: boolean;
  can: (role: WorkspaceRole) => boolean;
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

// Ids are known from the URL immediately, so children render before /me loads.
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { data: me, isLoading } = useApi<Me>("/me");

  const value = useMemo<WorkspaceValue>(() => {
    const workspace = me?.workspaces.find((w) => w.id === workspaceId);
    return {
      workspaceId,
      base: `/workspaces/${workspaceId}`,
      href: (path = "") => `/w/${workspaceId}${path}`,
      me,
      workspace,
      loading: isLoading || !me,
      missing: Boolean(me) && !workspace,
      can: (role) => (workspace ? RANK[workspace.role] >= RANK[role] : false),
    };
  }, [me, isLoading, workspaceId]);

  return <WorkspaceContext value={value}>{children}</WorkspaceContext>;
}

export function useWorkspace(): WorkspaceValue {
  const value = use(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return value;
}
