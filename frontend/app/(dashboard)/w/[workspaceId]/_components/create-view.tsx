"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LuSparkles } from "react-icons/lu";
import { Button, ButtonLink, Card, EmptyState, ErrorNote, PageHeader, Textarea } from "@/app/components/ui";
import { FormSkeleton } from "@/app/components/skeletons";
import { api, useApi } from "@/app/lib/api/client";
import type { Account, PlatformInfo, Post, PublishOutcome, VariantsResult } from "@/app/lib/api/types";
import { graphemes, toLocalInput } from "@/app/lib/format";
import { AccountPicker } from "./account-picker";
import { lengthFor, PlatformPreview } from "./platform-preview";
import { RoleGate } from "./role-gate";
import { WhenPicker, type When } from "./when-picker";
import { useWorkspace } from "./workspace-context";

const isFuture = (local: string) => new Date(local).getTime() > Date.now();
const SUBMIT_LABEL: Record<When, string> = { now: "Publish", schedule: "Schedule", draft: "Save draft" };

export function CreateView() {
  return (
    <RoleGate role="editor" skeleton={<FormSkeleton fields={4} />}>
      <Composer />
    </RoleGate>
  );
}

function Composer() {
  const { base, href, can } = useWorkspace();
  const router = useRouter();
  const { data: accounts } = useApi<Account[]>(`${base}/accounts`);
  const { data: caps } = useApi<PlatformInfo[]>("/integrations");
  const capOf = useMemo(() => new Map((caps ?? []).map((c) => [c.platform, c])), [caps]);

  const [selected, setSelected] = useState<string[]>([]);
  const [body, setBody] = useState("");
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [when, setWhen] = useState<When>("now");
  const [scheduledAt, setScheduledAt] = useState(() => toLocalInput(new Date(Date.now() + 3_600_000)));
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<"submit" | "ai" | null>(null);

  if (!accounts) return <FormSkeleton fields={4} />;
  if (accounts.length === 0) {
    return (
      <EmptyState
        title="Connect an account first"
        body="Posts go out through the accounts connected to this workspace."
        action={can("admin") && <ButtonLink href={href("/accounts")}>Connect an account</ButtonLink>}
      />
    );
  }

  const chosen = accounts.filter((a) => selected.includes(a.id));
  const textFor = (a: Account) => overrides[a.id] ?? body;
  const tooLong = chosen.some((a) => lengthFor(textFor(a), capOf.get(a.platform)) > (capOf.get(a.platform)?.maxTextLength ?? Infinity));

  async function run(kind: "submit" | "ai", task: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await task();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }

  const draftWithAi = () =>
    run("ai", async () => {
      const result = await api<VariantsResult>(`${base}/agent/variants`, { body: { idea: body, accountIds: selected } });
      setOverrides(Object.fromEntries(result.variants.map((v) => [v.accountId, v.text])));
    });

  const submit = () =>
    run("submit", async () => {
      if (when === "schedule" && !isFuture(scheduledAt)) throw new Error("Pick a time in the future.");
      const post = await api<Post>(`${base}/posts`, {
        body: {
          body,
          ...(when === "schedule" && { scheduledAt: new Date(scheduledAt).toISOString() }),
          targets: chosen.map((a) => ({ accountId: a.id, ...(overrides[a.id] !== undefined && overrides[a.id] !== body && { text: overrides[a.id] }) })),
        },
      });
      if (when === "now") await api<PublishOutcome[]>(`${base}/posts/${post.id}/publish`, { method: "POST" });
      router.push(href(`/posts/${post.id}`));
    });

  return (
    <div>
      <PageHeader eyebrow="Compose" title="Create post" subtitle="Write once, then tune it for each platform." />
      <div className="grid gap-8 xl:grid-cols-2">
        <div className="space-y-6">
          <AccountPicker accounts={accounts} selected={selected} onChange={setSelected} />
          <Card className="p-4 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
            <Textarea aria-label="Post text" value={body} onChange={(e) => setBody(e.target.value)} placeholder="What do you want to share?" rows={8} maxLength={10_000} className="border-0 px-0 text-[15px] focus-visible:ring-0 focus-visible:ring-offset-0" />
            <div className="flex items-center justify-between border-t border-border pt-3">
              <Button variant="ghost" size="sm" onClick={draftWithAi} loading={busy === "ai"} disabled={!body.trim() || chosen.length === 0}>
                <LuSparkles className="h-4 w-4" aria-hidden /> Write for each platform with AI
              </Button>
              <span className="text-xs tabular-nums text-muted-foreground">{graphemes(body)} characters</span>
            </div>
          </Card>
          <WhenPicker when={when} onWhen={setWhen} scheduledAt={scheduledAt} onScheduledAt={setScheduledAt} />
          <ErrorNote error={error} />
          <Button onClick={submit} loading={busy === "submit"} disabled={chosen.length === 0 || !body.trim() || tooLong} size="lg">
            {SUBMIT_LABEL[when]}
          </Button>
        </div>
        <section aria-label="Preview per platform" className="space-y-3 xl:sticky xl:top-24 xl:self-start">
          <h2 className="text-sm font-semibold text-foreground">Preview per platform</h2>
          {chosen.length === 0 && <EmptyState title="Pick accounts to preview" body="Each platform shows its own character limit." />}
          {chosen.map((a) => (
            <PlatformPreview
              key={a.id}
              account={a}
              cap={capOf.get(a.platform)}
              text={textFor(a)}
              custom={overrides[a.id] !== undefined}
              onCustomize={() => setOverrides((o) => ({ ...o, [a.id]: body }))}
              onReset={() => setOverrides((o) => Object.fromEntries(Object.entries(o).filter(([id]) => id !== a.id)))}
              onChange={(text) => setOverrides((o) => ({ ...o, [a.id]: text }))}
            />
          ))}
        </section>
      </div>
    </div>
  );
}
