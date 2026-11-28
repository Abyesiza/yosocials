"use client";

import { useState } from "react";
import { LuExternalLink } from "react-icons/lu";
import { Avatar, Button, Card, Input, PlatformIcon, platformLabel, StatusBadge, Textarea } from "@/app/components/ui";
import type { PostTarget, TikTokOptions } from "@/app/lib/api/types";
import { compact, dateTime, toLocalInput } from "@/app/lib/format";
import { EngagementHistory } from "./engagement-history";
import { describeTikTok, TikTokSettings, useDisclosure, type MediaSummary } from "./tiktok-settings";

export const EDITABLE = ["draft", "scheduled", "failed"];

function timing(t: PostTarget) {
  if (t.status === "processing") return `Sent to ${platformLabel(t.account.platform)} ${dateTime(t.publishedAt)} · still processing`;
  if (t.publishedAt) return `Published ${dateTime(t.publishedAt)}`;
  if (!t.scheduledAt) return "No time set";
  return `${t.status === "draft" ? "Suggested for" : "Scheduled for"} ${dateTime(t.scheduledAt)}`;
}

export function TargetCard({
  target,
  editable,
  saving,
  onSave,
  media,
}: {
  target: PostTarget;
  editable: boolean;
  saving: boolean;
  onSave: (changes: { text?: string; scheduledAt?: string | null; options?: TikTokOptions }) => void;
  media: MediaSummary;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(target.text);
  const saved = (target.options ?? undefined) as TikTokOptions | undefined;
  const [options, setOptions] = useState<TikTokOptions | undefined>(saved);
  const disclosure = useDisclosure();
  const tiktok = target.account.platform === "tiktok";
  const [when, setWhen] = useState(target.scheduledAt ? toLocalInput(new Date(target.scheduledAt)) : "");
  const { account, metrics } = target;

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-3">
        <Avatar name={account.displayName} src={account.avatarUrl} size={36} />
        <div className="min-w-0 flex-1 text-sm">
          <p className="flex items-center gap-1.5 font-semibold text-foreground"><PlatformIcon platform={account.platform} size={14} /> {account.displayName}</p>
          <p className="text-xs text-muted-foreground">{timing(target)}</p>
        </div>
        <StatusBadge status={target.status} />
      </div>

      {editing ? (
        <div className="space-y-3">
          <Textarea aria-label={`Text for ${platformLabel(account.platform)}`} value={text} onChange={(e) => setText(e.target.value)} rows={5} />
          <Input type="datetime-local" aria-label="Publish date and time" value={when} onChange={(e) => setWhen(e.target.value)} className="max-w-xs" />
          {tiktok && (
            <TikTokSettings
              account={account}
              value={options}
              onChange={setOptions}
              media={media}
              disclose={disclosure.isOpen(target.id, options)}
              onDisclose={(on) => disclosure.set(target.id, on)}
            />
          )}
          <div className="flex gap-2">
            <Button size="sm" loading={saving} onClick={() => { onSave({ text, scheduledAt: when ? new Date(when).toISOString() : null, ...(tiktok && options?.mode && { options }) }); setEditing(false); }}>Save changes</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-[15px] leading-6 text-foreground">{target.text}</p>
      )}
      {tiktok && !editing && <p className="mt-3 text-xs text-muted-foreground">{describeTikTok(saved)}</p>}
      {target.lastError && (
        <p className={`mt-3 text-xs ${target.status === "processing" ? "text-warning" : "text-destructive"}`}>{target.lastError}</p>
      )}

      <div className="mt-3 flex items-center gap-2">
        {editable && !editing && <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit post</Button>}
        {target.externalUrl && (
          <a href={target.externalUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground sm:min-h-0">
            View on {platformLabel(account.platform)} <LuExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        )}
      </div>

      {target.status === "published" && (
        <div className="mt-4 border-t border-border pt-4">
          <dl className="grid grid-cols-4 gap-2 text-center">
            {(tiktok
              ? ([["Views", metrics.views], ["Likes", metrics.likes], ["Comments", metrics.replies], ["Shares", metrics.reposts]] as const)
              : ([["Likes", metrics.likes], ["Reposts", metrics.reposts], ["Replies", metrics.replies], ["Quotes", metrics.quotes]] as const)
            ).map(([label, value]) => (
              <div key={label}>
                <dd className="text-lg font-bold tabular-nums text-foreground">{compact(value)}</dd>
                <dt className="text-xs text-muted-foreground">{label}</dt>
              </div>
            ))}
          </dl>
          <EngagementHistory targetId={target.id} />
        </div>
      )}
    </Card>
  );
}
