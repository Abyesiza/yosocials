"use client";

import type { ReactNode } from "react";
import { EmptyState } from "@/app/components/ui";
import type { WorkspaceRole } from "@/app/lib/api/types";
import { useWorkspace } from "./workspace-context";

/** Shows `skeleton` until the role is known, then the page or a "not allowed" note. */
export function RoleGate({
  role,
  skeleton,
  children,
}: {
  role: WorkspaceRole;
  skeleton: ReactNode;
  children: ReactNode;
}) {
  const { loading, can } = useWorkspace();
  if (loading) return skeleton;
  if (!can(role)) {
    return (
      <EmptyState
        title={`You need the ${role} role for this page`}
        body="Ask a workspace admin to change your role."
      />
    );
  }
  return children;
}
