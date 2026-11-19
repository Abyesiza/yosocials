import type { Metadata } from "next";
import { NewWorkspaceForm } from "../../_components/new-workspace-form";

export const metadata: Metadata = { title: "New workspace" };

export default function NewWorkspacePage() {
  return <NewWorkspaceForm />;
}
