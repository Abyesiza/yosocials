"use client";

import Link from "next/link";
import { useState } from "react";
import { LuImagePlus } from "react-icons/lu";
import { Avatar, Button, Card, ErrorNote, PlatformIcon, platformLabel, StatusBadge, Textarea } from "@/app/components/ui";
import { api } from "@/app/lib/api/client";
import type { PlatformInfo, Post, PostTarget } from "@/app/lib/api/types";
import { clockIn, shortZone } from "@/app/lib/audience";
import { ChangeTime } from "./schedule-suggestions";
import { useWorkspace } from "./workspace-context";

/** One planned post for one account, in the review-and-approve list. */
export function PlanItem({
  post,
  target,
  zone,
  cap,
  outsideError,
  onPost,
  onRemove,
}: {
  post: Post;
  target: PostTarget;
  zone: string;
  cap?: PlatformInfo;
  /** An error from "Approve and schedule all" for this post. */
  outsideError?: unknown;
  onPost: (post: Post) => void;
  onRemove: (postId: string) => void;
}) {
  const { base, href } = useWorkspace();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(target.text);
  const [busy, setBusy] = useState<"text" | "approve" | "delete" | null>(null);
  const [error, setError] = useState<unknown>(null);
  const { account } = target;
  const platform = platformLabel(account.platform);
  const changeable = target.status === "draft" || target.status === "scheduled";
  const patchTarget = (body: object) => api<Post>(`${base}/posts/${post.id}/targets/${target.id}`, { method: "PATCH", body });

  async function run(kind: NonNullable<typeof busy>, task: () => Promise<void>) {
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

  const saveText = () => run("text", async () => { onPost(await patchTarget({ text })); setEditing(false); });
  const approve = () => run("approve", async () => onPost(await api<Post>(`${base}/posts/${post.id}/schedule`, { body: { targetIds: [target.id] } })));
  const remove = () => {
    const others = post.targets.length - 1;
    const extra = others > 0 ? ` It also deletes this post’s version for ${others} other ${others === 1 ? "account" : "accounts"}.` : "";
    if (!confirm(`Delete this draft for ${account.displayName} on ${platform}?${extra} This can’t be undone.`)) return;
    void run("delete", async () => { await api(`${base}/posts/${post.id}`, { method: "DELETE" }); onRemove(post.id); });
  };

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <Avatar name={account.displayName} src={account.avatarUrl} size={36} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-foreground">
            <PlatformIcon platform={account.platform} size={14} /> {account.displayName}
            <span className="font-normal text-muted-foreground">
              {target.scheduledAt ? `${clockIn(target.scheduledAt, zone)} ${shortZone(zone)}` : "No time yet"}
            </span>
          </p>
          {target.scheduleReason && <p className="mt-1 text-xs text-muted-foreground">Why this time: {target.scheduleReason}</p>}
        </div>
        <StatusBadge status={target.status} />
      </div>

      {editing ? (
        <div className="mt-3 space-y-2">
          <Textarea aria-label={`Text for ${account.displayName} on ${platform}`} value={text} onChange={(e) => setText(e.target.value)} rows={5} />
          <div className="flex gap-2">
            <Button size="sm" loading={busy === "text"} disabled={!text.trim()} onClick={saveText}>Save text</Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setText(target.text); }}>Cancel</Button>
          </div>
        </div>
      ) : (
        <p className="mt-3 whitespace-pre-wrap text-[15px] leading-6 text-foreground">{target.text}</p>
      )}

      {post.media.length === 0 && (
        <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <LuImagePlus className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {cap?.media?.required ? `${platform} needs a photo or video. ` : "No media yet. "}
            Add your own on the <Link href={href(`/posts/${post.id}`)} className="font-semibold text-primary underline underline-offset-2">post page</Link>.
          </span>
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {target.status === "draft" && <Button size="sm" loading={busy === "approve"} onClick={approve}>Approve and schedule</Button>}
        {changeable && (
          <ChangeTime accountId={account.id} zone={zone} current={target.scheduledAt} onPick={async (scheduledAt) => onPost(await patchTarget({ scheduledAt }))} />
        )}
        {changeable && !editing && <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Edit text</Button>}
        {target.status === "draft" && <Button size="sm" variant="destructive-ghost" loading={busy === "delete"} onClick={remove}>Delete draft</Button>}
      </div>
      <div className="mt-3 space-y-2 empty:hidden">
        <ErrorNote error={error} />
        {!error && <ErrorNote error={outsideError} />}
      </div>
    </Card>
  );
}
