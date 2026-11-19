"use client";

import { useApi } from "@/app/lib/api/client";
import type { MetricPoint } from "@/app/lib/api/types";
import { dateTime } from "@/app/lib/format";
import { useWorkspace } from "./workspace-context";

const total = (p: MetricPoint) => (p.likes ?? 0) + (p.reposts ?? 0) + (p.replies ?? 0) + (p.quotes ?? 0);

/** Total engagement over time for one published target. */
export function EngagementHistory({ targetId }: { targetId: string }) {
  const { base } = useWorkspace();
  const { data } = useApi<MetricPoint[]>(`${base}/analytics/targets/${targetId}/history`);
  if (!data || data.length < 2) {
    return <p className="mt-3 text-center text-xs text-muted-foreground">History appears after a few snapshots (every 15 minutes).</p>;
  }
  const values = data.map(total);
  const max = Math.max(...values, 1);
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 100},${30 - (v / max) * 28}`).join(" ");
  return (
    <figure className="mt-4">
      <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-14 w-full" role="img" aria-label={`Engagement grew from ${values[0]} to ${values[values.length - 1]}`}>
        <title>{`Engagement: ${values.join(", ")}`}</title>
        <polyline points={points} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>{dateTime(data[0].capturedAt)}</span>
        <span>Total engagement</span>
        <span>{dateTime(data[data.length - 1].capturedAt)}</span>
      </figcaption>
    </figure>
  );
}
