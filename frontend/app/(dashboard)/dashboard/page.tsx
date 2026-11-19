import type { Metadata } from "next";
import { WorkspaceRedirect } from "./_components/workspace-redirect";

export const metadata: Metadata = { title: "Opening workspace" };

export default function DashboardPage() {
  return <WorkspaceRedirect />;
}
