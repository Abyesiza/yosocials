"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { LuChevronLeft, LuChevronRight, LuSparkles } from "react-icons/lu";
import { Button, ButtonLink, Card, cn, ErrorNote, focusRing, PageHeader, PlatformIcon } from "@/app/components/ui";
import { CalendarSkeleton } from "@/app/components/skeletons";
import { useApi } from "@/app/lib/api/client";
import type { FeedItem, TargetStatus } from "@/app/lib/api/types";
import { useWorkspace } from "./workspace-context";

const DOT: Record<TargetStatus, string> = {
  draft: "bg-muted-foreground",
  scheduled: "bg-primary",
  publishing: "bg-warning",
  published: "bg-success",
  failed: "bg-destructive",
};

const DAY = 86_400_000;

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
const dayKey = (d: Date) => d.toDateString();
const whenOf = (i: FeedItem) => i.publishedAt ?? i.scheduledAt;

export function CalendarView() {
  const { base, href, can } = useWorkspace();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const query = new URLSearchParams({ from: weekStart.toISOString(), to: addDays(weekStart, 7).toISOString() });
  const { data, error } = useApi<FeedItem[]>(`${base}/calendar?${query}`);

  const byDay = useMemo(() => {
    const map = new Map<string, FeedItem[]>();
    for (const item of data ?? []) {
      const when = whenOf(item);
      if (when) map.set(dayKey(new Date(when)), [...(map.get(dayKey(new Date(when))) ?? []), item]);
    }
    return map;
  }, [data]);

  const today = dayKey(new Date());
  const fmt = (d: Date, year = false) => d.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(year && { year: "numeric" }) });

  return (
    <div>
      <PageHeader
        eyebrow="Content calendar"
        title={`${fmt(days[0])} – ${fmt(days[6], true)}`}
        subtitle="Drafts, scheduled and published posts across every account."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setWeekStart((w) => addDays(w, -7))} aria-label="Previous week"><LuChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>Today</Button>
            <Button variant="outline" size="sm" onClick={() => setWeekStart((w) => addDays(w, 7))} aria-label="Next week"><LuChevronRight className="h-4 w-4" /></Button>
            {can("editor") && <ButtonLink href={href("/plan")} size="sm"><LuSparkles className="h-4 w-4" aria-hidden /> Plan with AI</ButtonLink>}
          </>
        }
      />

      <ul aria-label="Status legend" className="mb-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        {(Object.keys(DOT) as TargetStatus[]).map((s) => (
          <li key={s} className="flex items-center gap-1.5 capitalize"><span className={cn("h-2 w-2 rounded-full", DOT[s])} />{s}</li>
        ))}
      </ul>

      <ErrorNote error={error} />
      {!data && !error ? (
        <CalendarSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {days.map((day) => (
            <Card key={day.toISOString()} className={cn("min-h-48 p-3", dayKey(day) === today && "ring-2 ring-primary")}>
              <h2 className="mb-2 flex items-baseline gap-1.5 px-1 text-sm">
                <span className="font-semibold text-foreground">{day.toLocaleDateString(undefined, { weekday: "short" })}</span>
                <span className="text-muted-foreground">{day.getDate()}</span>
              </h2>
              <ul className="space-y-2">
                {(byDay.get(dayKey(day)) ?? []).map((item) => (
                  <li key={item.id}>
                    <Link href={href(`/posts/${item.postId}`)} className={cn("block rounded-md bg-muted p-2.5 transition-colors hover:bg-primary/10", focusRing)}>
                      <span className="flex items-center gap-1.5 whitespace-nowrap text-[11px] text-muted-foreground">
                        <span className={cn("h-1.5 w-1.5 rounded-full", DOT[item.status])} />
                        <span className="sr-only">{item.status}</span>
                        <PlatformIcon platform={item.account.platform} size={11} />
                        {new Date(whenOf(item)!).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                      </span>
                      <span className="mt-1 line-clamp-3 text-xs leading-4 text-foreground">{item.postTitle ?? item.text}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
