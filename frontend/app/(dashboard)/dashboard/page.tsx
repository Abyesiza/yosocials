import type { Metadata } from "next";
import { PRIVATE_METADATA } from "@/app/lib/seo";
import { WorkspaceRedirect } from "./_components/workspace-redirect";

export const metadata: Metadata = { ...PRIVATE_METADATA, title: "Opening workspace" };

export default function DashboardPage() {
  return <WorkspaceRedirect />;
}
