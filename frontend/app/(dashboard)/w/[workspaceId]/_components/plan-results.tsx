"use client";

import Link from "next/link";
import { Button, Card, EmptyState, PlatformIcon, StatusBadge } from "@/app/components/ui";
import type { PlanResult } from "@/app/lib/api/types";
import { dateTime } from "@/app/lib/format";
import { useWorkspace } from "./workspace-context";

export function PlanResults({
  result,
  approving,
  onApproveAll,
}: {
  result: PlanResult | null;
  approving: boolean;
  onApproveAll: () => void;
}) {
  const { href } = useWorkspace();
  if (!result) {
    return <EmptyState title="Your drafts appear here" body="Nothing is posted until you approve it." />;
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-bold text-foreground">
          {result.posts.length} draft{result.posts.length === 1 ? "" : "s"}
          <span className="ml-2 text-xs font-normal text-muted-foreground">by {result.model}</span>
        </h2>
        {result.posts.some((p) => p.status === "draft") && (
          <Button size="sm" onClick={onApproveAll} loading={approving}>Approve all & schedule</Button>
        )}
      </div>
      {result.skipped.length > 0 && (
        <details className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          <summary className="cursor-pointer font-semibold">
            {result.skipped.length} suggestion{result.skipped.length === 1 ? " was" : "s were"} dropped for breaking platform rules
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
            {result.skipped.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </details>
      )}
      {result.posts.map((post) => (
        <Card key={post.id} className="p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Link href={href(`/posts/${post.id}`)} className="font-semibold text-foreground hover:underline">{post.title ?? "Untitled"}</Link>
            <StatusBadge status={post.status} />
          </div>
          <ul className="space-y-3">
            {post.targets.map((t) => (
              <li key={t.id} className="text-sm">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <PlatformIcon platform={t.account.platform} size={12} /> {t.account.displayName} · {dateTime(t.scheduledAt)}
                </span>
                <p className="mt-0.5 line-clamp-4 whitespace-pre-wrap text-foreground">{t.text}</p>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
