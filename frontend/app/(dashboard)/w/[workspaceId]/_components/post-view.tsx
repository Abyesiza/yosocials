"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { LuArrowLeft } from "react-icons/lu";
import { Button, Card, CardHeader, EmptyState, ErrorNote, PageHeader, StatusBadge } from "@/app/components/ui";
import { FeedSkeleton, PageHeaderSkeleton } from "@/app/components/skeletons";
import { api, useApi } from "@/app/lib/api/client";
import type { Post, PublishOutcome } from "@/app/lib/api/types";
import { dateTime } from "@/app/lib/format";
import { EDITABLE, TargetCard } from "./target-card";
import { useWorkspace } from "./workspace-context";

export function PostView() {
  const { postId } = useParams<{ postId: string }>();
  const { base, href, can } = useWorkspace();
  const router = useRouter();
  const { data: post, error, mutate } = useApi<Post>(`${base}/posts/${postId}`);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);

  if (error) return <EmptyState title="Post not found" body={error.message} />;
  if (!post) return <><PageHeaderSkeleton /><FeedSkeleton count={2} /></>;

  async function run(label: string, call: () => Promise<unknown>) {
    setBusy(label);
    setActionError(null);
    try {
      await call();
      await mutate();
    } catch (e) {
      setActionError(e);
    } finally {
      setBusy(null);
    }
  }

  const publishNow = () =>
    run("publish", async () => {
      const outcomes = await api<PublishOutcome[]>(`${base}/posts/${post.id}/publish`, { method: "POST" });
      const failed = outcomes.filter((o) => o.error);
      if (failed.length) throw new Error(failed.map((f) => f.error).join("\n"));
    });

  const remove = () => {
    if (!confirm("Delete this post from Yo Socials? Anything already published stays live.")) return;
    void run("delete", async () => {
      await api(`${base}/posts/${post.id}`, { method: "DELETE" });
      router.push(href());
    });
  };

  const editor = can("editor");
  const has = (s: string) => post.targets.some((t) => t.status === s);
  const unpublished = post.targets.some((t) => EDITABLE.includes(t.status));

  return (
    <div>
      <Link href={href()} className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"><LuArrowLeft className="h-4 w-4" aria-hidden /> Back to feed</Link>
      <PageHeader eyebrow={post.source === "agent" ? "Planned by AI" : "Post"} title={post.title ?? "Post"} subtitle={`Created ${dateTime(post.createdAt)}`} />
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid content-start gap-4 lg:grid-cols-2">
          {post.targets.map((t) => (
            <TargetCard
              key={t.id}
              target={t}
              editable={editor && EDITABLE.includes(t.status)}
              saving={busy === `save-${t.id}`}
              onSave={(changes) => run(`save-${t.id}`, () => api(`${base}/posts/${post.id}/targets/${t.id}`, { method: "PATCH", body: changes }))}
            />
          ))}
        </div>
        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <Card>
            <CardHeader title="Status" action={<StatusBadge status={post.status} />} />
            <div className="space-y-2 p-5">
              <ErrorNote error={actionError} />
              {editor && unpublished ? (
                <>
                  {has("draft") && <Button className="w-full" loading={busy === "schedule"} onClick={() => run("schedule", () => api(`${base}/posts/${post.id}/schedule`, { method: "POST", body: {} }))}>Approve & schedule</Button>}
                  <Button className="w-full" variant={has("draft") ? "outline" : "primary"} loading={busy === "publish"} onClick={publishNow}>Publish now</Button>
                  {has("scheduled") && <Button className="w-full" variant="outline" loading={busy === "unschedule"} onClick={() => run("unschedule", () => api(`${base}/posts/${post.id}/unschedule`, { method: "POST" }))}>Move back to drafts</Button>}
                  <Button className="w-full" variant="destructive-ghost" loading={busy === "delete"} onClick={remove}>Delete post</Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{unpublished ? "Editors can schedule or publish this post." : "Everything here is live."}</p>
              )}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
