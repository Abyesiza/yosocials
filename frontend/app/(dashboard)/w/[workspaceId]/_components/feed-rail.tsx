"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Avatar, Card, CardHeader, cn, focusRing, PlatformIcon } from "@/app/components/ui";
import { Bone } from "@/app/components/skeletons";
import { useApi } from "@/app/lib/api/client";
import type { FeedItem, Overview } from "@/app/lib/api/types";
import { compact, dateTime } from "@/app/lib/format";
import { useWorkspace } from "./workspace-context";

export function FeedRail() {
  return (
    <aside className="space-y-6 2xl:sticky 2xl:top-24 2xl:self-start">
      <ThisWeek />
      <UpNext />
    </aside>
  );
}

function ThisWeek() {
  const { base, href } = useWorkspace();
  const { data } = useApi<Overview>(`${base}/analytics/overview?days=7`);
  const stats = [
    ["Posts", data?.totals.posts],
    ["Engagement", data?.totals.engagement],
    ["Likes", data?.totals.likes],
    ["Replies", data?.totals.replies],
  ] as const;
  return (
    <Card>
      <CardHeader title="Last 7 days" action={<Link href={href("/analytics")} className="text-xs font-semibold text-primary hover:underline">View analytics</Link>} />
      <dl className="grid grid-cols-2 gap-px bg-border">
        {stats.map(([label, value]) => (
          <div key={label} className="bg-card px-5 py-4">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-xl font-bold tabular-nums text-foreground">
              {data ? compact(value) : <Bone className="h-6 w-12" />}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function UpNext() {
  const { base, href } = useWorkspace();
  const range = useMemo(() => {
    const from = new Date();
    return new URLSearchParams({ from: from.toISOString(), to: new Date(from.getTime() + 7 * 86_400_000).toISOString() });
  }, []);
  const { data } = useApi<FeedItem[]>(`${base}/calendar?${range}`);
  const upcoming = (data ?? []).filter((i) => i.status === "scheduled").slice(0, 6);

  return (
    <Card>
      <CardHeader title="Up next" action={<Link href={href("/calendar")} className="text-xs font-semibold text-primary hover:underline">View calendar</Link>} />
      {!data && <div className="space-y-3 p-5"><Bone className="h-10 w-full" /><Bone className="h-10 w-full" /></div>}
      {data && upcoming.length === 0 && <p className="px-5 py-4 text-sm text-muted-foreground">Nothing scheduled for the next 7 days.</p>}
      <ul className="divide-y divide-border">
        {upcoming.map((i) => (
          <li key={i.id}>
            <Link href={href(`/posts/${i.postId}`)} className={cn("flex gap-3 px-5 py-3 hover:bg-muted", focusRing)}>
              <Avatar name={i.account.displayName} src={i.account.avatarUrl} size={32} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <PlatformIcon platform={i.account.platform} size={12} /> {dateTime(i.scheduledAt)}
                </span>
                <span className="line-clamp-2 text-sm text-foreground">{i.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
