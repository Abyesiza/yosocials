"use client";

import Link from "next/link";
import { useState } from "react";
import { LuRefreshCw } from "react-icons/lu";
import { Button, Card, CardHeader, Chip, cn, EmptyState, ErrorNote, focusRing, PageHeader, PlatformIcon } from "@/app/components/ui";
import { RowsSkeleton, StatTilesSkeleton } from "@/app/components/skeletons";
import { api, useApi } from "@/app/lib/api/client";
import type { Overview } from "@/app/lib/api/types";
import { compact, timeAgo } from "@/app/lib/format";
import { useWorkspace } from "./workspace-context";

const RANGES = [7, 30, 90] as const;

export function AnalyticsView() {
  const { base, can } = useWorkspace();
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const { data, error, mutate } = useApi<Overview>(`${base}/analytics/overview?days=${days}`);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<unknown>(null);

  async function refresh() {
    setRefreshing(true);
    setRefreshError(null);
    try {
      await api(`${base}/analytics/refresh`, { method: "POST" });
      await mutate();
    } catch (e) {
      setRefreshError(e);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Performance"
        title="Analytics"
        subtitle="How your posts performed across every connected account."
        actions={can("editor") && <Button variant="outline" size="sm" onClick={refresh} loading={refreshing}><LuRefreshCw className="h-4 w-4" aria-hidden /> Refresh now</Button>}
      />
      <div role="group" aria-label="Time range" className="mb-6 flex gap-2">
        {RANGES.map((r) => <Chip key={r} active={days === r} onClick={() => setDays(r)}>{r} days</Chip>)}
      </div>
      <ErrorNote error={error ?? refreshError} />
      {!data && !error && (
        <div className="space-y-8"><StatTilesSkeleton /><RowsSkeleton /></div>
      )}
      {data && data.totals.posts === 0 && <EmptyState title="No published posts in this range" body="Analytics appear once posts are published. We update them every 30 minutes, or every 6 hours on X." />}
      {data && data.totals.posts > 0 && <Report data={data} />}
    </div>
  );
}

function Report({ data }: { data: Overview }) {
  const { href } = useWorkspace();
  const max = Math.max(1, ...data.accounts.map((a) => a.engagement));
  const tiles = [["Posts", data.totals.posts], ["Engagement", data.totals.engagement], ["Likes", data.totals.likes], ["Reposts", data.totals.reposts], ["Replies", data.totals.replies]] as const;

  return (
    <div className="space-y-8">
      <dl className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {tiles.map(([label, value]) => (
          <Card key={label} className="p-5">
            <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-foreground">{compact(value)}</dd>
          </Card>
        ))}
      </dl>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Engagement by account" />
          <ul className="divide-y divide-border">
            {data.accounts.map((a) => (
              <li key={a.accountId} className="flex items-center gap-3 px-5 py-3" title={`${a.displayName}: ${a.engagement} engagement across ${a.posts} posts (${a.likes} likes, ${a.reposts} reposts, ${a.replies} replies, ${a.quotes} quotes)`}>
                <PlatformIcon platform={a.platform} />
                <div className="w-36 min-w-0 shrink-0">
                  <p className="truncate text-sm font-semibold text-foreground">{a.displayName}</p>
                  <p className="text-xs text-muted-foreground">{a.posts} posts</p>
                </div>
                <div className="h-2 flex-1 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${(a.engagement / max) * 100}%` }} /></div>
                <span className="w-12 text-right text-sm font-semibold tabular-nums text-foreground">{compact(a.engagement)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Top posts" />
          <ol className="divide-y divide-border">
            {data.topPosts.map((p, i) => (
              <li key={p.targetId}>
                <Link href={href(`/posts/${p.postId}`)} className={cn("flex items-start gap-3 px-5 py-3 hover:bg-muted", focusRing)}>
                  <span className="w-4 text-sm font-bold text-muted-foreground">{i + 1}</span>
                  <PlatformIcon platform={p.platform} />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm text-foreground">{p.text}</span>
                    <span className="text-xs text-muted-foreground">{p.handle} · {timeAgo(p.publishedAt)}</span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-foreground">{compact(p.engagement)}</span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}
