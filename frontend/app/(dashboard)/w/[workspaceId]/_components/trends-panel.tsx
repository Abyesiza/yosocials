"use client";

import Link from "next/link";
import { LuExternalLink, LuPlus, LuTrendingUp } from "react-icons/lu";
import { Button, Card, CardHeader, ErrorNote, PlatformIcon } from "@/app/components/ui";
import { useApi } from "@/app/lib/api/client";
import type { TrendItem, TrendSnapshot } from "@/app/lib/api/types";
import { countryName } from "@/app/lib/audience";
import { timeUntil } from "@/app/lib/format";
import { useWorkspace } from "./workspace-context";

const external = { target: "_blank", rel: "noopener noreferrer" } as const;

function traffic(item: TrendItem): string | null {
  if (!item.traffic) return null;
  return item.source === "google_trends" ? `${item.traffic} searches` : `${item.traffic} posts in the last day`;
}

/** Trend lists, grouped: country-level Google Trends, then platform-wide Mastodon and Bluesky. */
export function TrendGroups({ snapshot, onAdd, limit = 8 }: { snapshot: TrendSnapshot; onAdd?: (term: string) => void; limit?: number }) {
  const local = snapshot.items.filter((i) => i.scope === "country");
  const global = snapshot.items.filter((i) => i.scope === "global");
  const name = countryName(snapshot.country);
  return (
    <div className="space-y-5">
      {local.length > 0 && <TrendList title={`In ${name} today (Google Trends)`} items={local.slice(0, limit)} onAdd={onAdd} />}
      {global.length > 0 && (
        <TrendList title="Across Mastodon and Bluesky" note="Platform-wide, not only your country." items={global.slice(0, limit)} onAdd={onAdd} />
      )}
      {snapshot.items.length === 0 && <p className="text-sm text-muted-foreground">Nothing is trending in our sources right now. Check again later.</p>}
      {snapshot.notes.length > 0 && (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {snapshot.notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">Updated {timeUntil(snapshot.updatedAt)}.</p>
    </div>
  );
}

function TrendList({ title, note, items, onAdd }: { title: string; note?: string; items: TrendItem[]; onAdd?: (term: string) => void }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      <ul className="mt-2 divide-y divide-border">
        {items.map((item) => (
          <li key={`${item.source}-${item.term}`} className="flex items-start gap-3 py-2.5">
            {item.source !== "google_trends" && <span className="mt-1"><PlatformIcon platform={item.source} size={14} /></span>}
            <div className="min-w-0 flex-1">
              {item.url ? (
                <a href={item.url} {...external} className="inline-flex items-center gap-1 text-sm font-semibold text-foreground hover:underline">
                  {item.term} <LuExternalLink className="h-3 w-3" aria-hidden /><span className="sr-only">(opens in a new tab)</span>
                </a>
              ) : (
                <span className="text-sm font-semibold text-foreground">{item.term}</span>
              )}
              {traffic(item) && <p className="text-xs text-muted-foreground">{traffic(item)}</p>}
              {item.news.slice(0, 2).map((n) => (
                <a key={n.url} href={n.url} {...external} className="mt-1 block truncate text-xs text-muted-foreground hover:text-foreground hover:underline">
                  {n.title} · {n.source}<span className="sr-only"> (opens in a new tab)</span>
                </a>
              ))}
            </div>
            {onAdd && (
              <Button size="sm" variant="ghost" onClick={() => onAdd(item.term)} aria-label={`Add “${item.term}” to brief`}>
                <LuPlus className="h-4 w-4" aria-hidden /> Add to brief
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "Trending now" for the plan's audience country. */
export function TrendsPanel({ country, onAdd }: { country: string; onAdd: (term: string) => void }) {
  const { base, href, can } = useWorkspace();
  const { data, error, isLoading } = useApi<TrendSnapshot>(country ? `${base}/trends?country=${country}` : null, { revalidateOnFocus: false });
  return (
    <Card>
      <CardHeader title="Trending now" action={<LuTrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden />} />
      <div className="p-5" aria-busy={isLoading}>
        {!country && (
          <p className="text-sm text-muted-foreground">
            Choose an audience country in the form to see what’s trending there.
            {can("admin") && <> You can also <Link href={href("/settings")} className="font-semibold text-primary underline underline-offset-2">set it for the workspace</Link>.</>}
          </p>
        )}
        {isLoading && <p role="status" className="text-sm text-muted-foreground">Loading what’s trending…</p>}
        <ErrorNote error={error} />
        {data && <TrendGroups snapshot={data} onAdd={onAdd} />}
      </div>
    </Card>
  );
}
