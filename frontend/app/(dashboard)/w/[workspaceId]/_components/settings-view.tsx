"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { Button, Card, ErrorNote, PageHeader } from "@/app/components/ui";
import { FormSkeleton } from "@/app/components/skeletons";
import { api } from "@/app/lib/api/client";
import { AudienceCard } from "./audience-card";
import { MembersCard } from "./members-card";
import { WorkspaceCard } from "./workspace-card";
import { useWorkspace } from "./workspace-context";

export function SettingsView() {
  const { workspace, loading } = useWorkspace();
  if (loading || !workspace) return <FormSkeleton fields={2} />;
  return (
    <div>
      <PageHeader eyebrow="Workspace" title="Settings" subtitle={`${workspace.name} · your role: ${workspace.role}`} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="space-y-6">
          <WorkspaceCard />
          <AudienceCard />
          <DangerZone />
        </div>
        <MembersCard />
      </div>
    </div>
  );
}

function DangerZone() {
  const { base, workspace, can } = useWorkspace();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  if (!can("owner") || !workspace) return null;

  async function remove() {
    if (prompt(`Deleting “${workspace!.name}” removes its connected accounts, posts and analytics from Aby Socials. Posts already published stay live. This can’t be undone.\n\nType the workspace name to confirm:`) !== workspace!.name) return;
    setPending(true);
    setError(null);
    try {
      await api(base, { method: "DELETE" });
      await mutate("/me");
      router.replace("/dashboard");
    } catch (e) {
      setError(e);
      setPending(false);
    }
  }

  return (
    <Card className="space-y-3 border-destructive/40 p-5">
      <h2 className="text-sm font-semibold text-destructive">Danger zone</h2>
      <p className="text-sm text-muted-foreground">Delete this workspace with its connected accounts, posts and analytics. Posts already published stay live. This can’t be undone.</p>
      <ErrorNote error={error} />
      <Button variant="destructive" loading={pending} onClick={remove}>Delete workspace</Button>
    </Card>
  );
}
