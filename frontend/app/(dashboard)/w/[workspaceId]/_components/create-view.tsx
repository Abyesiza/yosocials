"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { LuSparkles } from "react-icons/lu";
import { Button, ButtonLink, Card, EmptyState, ErrorNote, PageHeader, Textarea } from "@/app/components/ui";
import { FormSkeleton } from "@/app/components/skeletons";
import { api, useApi } from "@/app/lib/api/client";
import type { Account, PlatformInfo, Post, PublishOutcome, TikTokOptions, VariantsResult } from "@/app/lib/api/types";
import { graphemes, toLocalInput } from "@/app/lib/format";
import { AccountPicker } from "./account-picker";
import { MediaPicker, toMediaBody, type DraftMedia } from "./media-picker";
import { lengthFor, PlatformPreview } from "./platform-preview";
import { resolveZone } from "./calendar-utils";
import { RoleGate } from "./role-gate";
import { SuggestedTimes } from "./suggested-times";
import { tiktokIssues, TikTokSettings, useDisclosure, type MediaSummary } from "./tiktok-settings";
import { WhenPicker, type When } from "./when-picker";
import { useWorkspace } from "./workspace-context";

const isFuture = (local: string) => new Date(local).getTime() > Date.now();
const isoOf = (local: string) => {
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const SUBMIT_LABEL: Record<When, string> = { now: "Publish now", schedule: "Schedule post", draft: "Save draft" };

export function CreateView() {
  return (
    <RoleGate role="editor" skeleton={<FormSkeleton fields={4} />}>
      <Composer />
    </RoleGate>
  );
}

function Composer() {
  const { base, href, can, workspace } = useWorkspace();
  const zone = resolveZone(workspace?.audienceTimeZone);
  const router = useRouter();
  const { data: accounts } = useApi<Account[]>(`${base}/accounts`);
  const { data: caps } = useApi<PlatformInfo[]>("/integrations");
  const capOf = useMemo(() => new Map((caps ?? []).map((c) => [c.platform, c])), [caps]);

  const [selected, setSelected] = useState<string[]>([]);
  const [body, setBody] = useState("");
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [media, setMedia] = useState<DraftMedia[]>([]);
  const [tiktok, setTiktok] = useState<Record<string, TikTokOptions>>({});
  const disclosure = useDisclosure();
  // The calendar links here with `?at=<ISO>` for the slot that was clicked.
  const at = useSearchParams().get("at");
  const preset = at && isFuture(at) ? new Date(at) : null;
  const [when, setWhen] = useState<When>(preset ? "schedule" : "now");
  const [scheduledAt, setScheduledAt] = useState(() => toLocalInput(preset ?? new Date(Date.now() + 3_600_000)));
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
  const chosenPlatforms = [...new Set(chosen.map((a) => a.platform))];
  const chosenCaps = chosenPlatforms.flatMap((p) => capOf.get(p) ?? []);
  const textFor = (a: Account) => overrides[a.id] ?? body;
  const tooLong = chosen.some((a) => lengthFor(textFor(a), capOf.get(a.platform)) > (capOf.get(a.platform)?.maxTextLength ?? Infinity));
  const summary: MediaSummary = { kind: media[0]?.kind ?? null, durationSec: media[0]?.durationSec ?? null };
  const tiktokAccounts = chosen.filter((a) => a.platform === "tiktok");
  // Drafts can be saved unfinished; posting and scheduling need every TikTok setting.
  const blockers = when === "draft" ? [] : tiktokAccounts.flatMap((a) => tiktokIssues(tiktok[a.id], undefined, summary, disclosure.isOpen(a.id, tiktok[a.id])));

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
      if (when === "schedule" && !isFuture(scheduledAt)) throw new Error("Choose a time in the future.");
      const post = await api<Post>(`${base}/posts`, {
        body: {
          body,
          media: toMediaBody(media, chosenPlatforms),
          ...(when === "schedule" && { scheduledAt: new Date(scheduledAt).toISOString() }),
          targets: chosen.map((a) => ({
            accountId: a.id,
            ...(overrides[a.id] !== undefined && overrides[a.id] !== body && { text: overrides[a.id] }),
            ...(tiktok[a.id]?.mode && { options: tiktok[a.id] }),
          })),
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
          <MediaPicker media={media} onChange={setMedia} platforms={chosenCaps} />
          {tiktokAccounts.map((a) => (
            <TikTokSettings
              key={a.id}
              account={a}
              value={tiktok[a.id]}
              onChange={(options) => setTiktok((t) => ({ ...t, [a.id]: options }))}
              media={summary}
              disclose={disclosure.isOpen(a.id, tiktok[a.id])}
              onDisclose={(on) => disclosure.set(a.id, on)}
            />
          ))}
          <WhenPicker when={when} onWhen={setWhen} scheduledAt={scheduledAt} onScheduledAt={setScheduledAt}>
            {chosen.length > 0 && (
              <SuggestedTimes accounts={chosen} caps={chosenCaps} zone={zone} selected={isoOf(scheduledAt)} onPick={(iso) => setScheduledAt(toLocalInput(new Date(iso)))} />
            )}
          </WhenPicker>
          {blockers.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {blockers.map((b) => <li key={b}>{b}</li>)}
            </ul>
          )}
          <ErrorNote error={error} />
          <Button onClick={submit} loading={busy === "submit"} disabled={chosen.length === 0 || !body.trim() || tooLong || blockers.length > 0} size="lg">
            {SUBMIT_LABEL[when]}
          </Button>
        </div>
        <section aria-label="Preview per platform" className="space-y-3 xl:sticky xl:top-24 xl:self-start">
          <h2 className="text-sm font-semibold text-foreground">Preview per platform</h2>
          {chosen.length === 0 && <EmptyState title="Choose accounts to see previews" body="Each platform shows its own character limit." />}
          {chosen.map((a) => (
            <PlatformPreview
              key={a.id}
              account={a}
              cap={capOf.get(a.platform)}
              text={textFor(a)}
              mediaCount={media.length}
              media={media}
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
