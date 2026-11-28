"use client";

import { useMemo, useState } from "react";
import { LuCalendarDays, LuCircleCheck } from "react-icons/lu";
import { Button, ButtonLink, EmptyState, ErrorNote } from "@/app/components/ui";
import { api } from "@/app/lib/api/client";
import type { PlanResult, PlatformInfo, Post, PostTarget } from "@/app/lib/api/types";
import { dayHeading, dayIn, shortZone } from "@/app/lib/audience";
import { PlanItem } from "./plan-item";
import { PlanSources } from "./plan-sources";
import { useWorkspace } from "./workspace-context";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Planned targets grouped by day in the audience zone, earliest first. */
function agenda(posts: Post[], zone: string) {
  const rows = posts
    .flatMap((post) => post.targets.map((target) => ({ post, target })))
    .sort((a, b) => (a.target.scheduledAt ?? "9").localeCompare(b.target.scheduledAt ?? "9"));
  const days = new Map<string, { post: Post; target: PostTarget }[]>();
  for (const row of rows) {
    const day = row.target.scheduledAt ? dayIn(row.target.scheduledAt, zone) : "";
    days.set(day, [...(days.get(day) ?? []), row]);
  }
  return [...days];
}

/** The review-and-approve step: nothing is scheduled until the person approves it. */
export function PlanResults({
  result,
  caps,
  onPosts,
}: {
  result: PlanResult | null;
  caps: PlatformInfo[];
  onPosts: (update: (posts: Post[]) => Post[]) => void;
}) {
  const { base, href } = useWorkspace();
  const [approving, setApproving] = useState(false);
  const [errors, setErrors] = useState<Record<string, unknown>>({});
  const zone = result?.timeZone ?? "UTC";
  const days = useMemo(() => (result ? agenda(result.posts, zone) : []), [result, zone]);

  if (!result) return <EmptyState title="Your plan appears here" body="Review each post and its time, then approve it. Nothing is posted until you approve it." />;

  const drafts = result.posts.filter((p) => p.targets.some((t) => t.status === "draft"));
  const scheduled = result.posts.flatMap((p) => p.targets).filter((t) => t.status === "scheduled").length;
  const capOf = (platform: string) => caps.find((c) => c.platform === platform);
  const replace = (post: Post) => onPosts((posts) => posts.map((p) => (p.id === post.id ? post : p)));
  const remove = (id: string) => onPosts((posts) => posts.filter((p) => p.id !== id));

  async function approveAll() {
    setApproving(true);
    const failed: Record<string, unknown> = {};
    for (const post of drafts) {
      try {
        replace(await api<Post>(`${base}/posts/${post.id}/schedule`, { body: {} }));
      } catch (e) {
        failed[post.id] = e;
      }
    }
    setErrors(failed);
    setApproving(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-foreground">{plural(result.posts.length, "planned post")}</h2>
          <p className="text-xs text-muted-foreground">Times are in your audience’s time zone ({result.timeZone}, {shortZone(zone)}).</p>
        </div>
        {drafts.length > 0 && (
          <div className="text-right">
            <Button onClick={approveAll} loading={approving}>Approve and schedule all ({drafts.length})</Button>
            <p className="mt-1 text-xs text-muted-foreground">Nothing is posted until you approve it.</p>
          </div>
        )}
      </div>

      {Object.keys(errors).length > 0 && (
        <ErrorNote error={`We couldn’t schedule ${plural(Object.keys(errors).length, "post")}. The reason is shown on each one.`} />
      )}
      {scheduled > 0 && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          <LuCircleCheck className="h-4 w-4 shrink-0" aria-hidden />
          <span className="flex-1">{plural(scheduled, "post")} scheduled. We’ll post them at their times.</span>
          <ButtonLink href={href("/calendar")} size="sm" variant="outline"><LuCalendarDays className="h-4 w-4" aria-hidden /> View calendar</ButtonLink>
        </div>
      )}

      {result.posts.length === 0 && <EmptyState title="AI didn’t plan any posts" body="Try a longer brief, more days or other accounts." />}

      {days.map(([day, rows]) => (
        <section key={day || "none"} aria-labelledby={`day-${day || "none"}`} className="space-y-3">
          <h3 id={`day-${day || "none"}`} className="text-sm font-semibold text-foreground">{day ? dayHeading(day) : "No time yet"}</h3>
          {rows.map(({ post, target }) => (
            <PlanItem key={target.id} post={post} target={target} zone={zone} cap={capOf(target.account.platform)} outsideError={errors[post.id]} onPost={replace} onRemove={remove} />
          ))}
        </section>
      ))}

      <PlanSources result={result} />
    </div>
  );
}
