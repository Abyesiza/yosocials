"use client";

import type { ReactNode } from "react";
import { ButtonLink, EmptyState } from "@/app/components/ui";
import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardTopBar } from "./dashboard-top-bar";
import { useWorkspace, WorkspaceProvider } from "./workspace-context";

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <DashboardSidebar />
      <div className="flex min-h-screen min-w-0 flex-col md:pl-64">
        <DashboardTopBar />
        <main id="main" className="flex-1 px-4 py-6 md:px-8 md:py-8 xl:px-10">
          <MissingGuard>{children}</MissingGuard>
        </main>
      </div>
    </WorkspaceProvider>
  );
}

// Children always render; only a confirmed non-member sees the empty state instead.
function MissingGuard({ children }: { children: ReactNode }) {
  const { missing } = useWorkspace();
  if (!missing) return children;
  return (
    <EmptyState
      title="Workspace not found"
      body="It may have been deleted, or you're no longer a member."
      action={<ButtonLink href="/dashboard">Go to my workspaces</ButtonLink>}
    />
  );
}
