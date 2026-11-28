import type { EventInput } from "@fullcalendar/react";
import { Temporal } from "temporal-polyfill";
import { isNearBlack } from "@/app/components/ui";
import type { FeedItem, Platform, PostingWindow, TargetStatus } from "@/app/lib/api/types";
import { platforms, type PlatformKey } from "@/app/lib/platforms";

/** Statuses whose time can still change (mirrors the API's EDITABLE_STATUSES). */
export const MOVABLE: readonly TargetStatus[] = ["draft", "scheduled", "failed"];

export const VIEWS = [
  { type: "dayGridMonth", label: "Month" },
  { type: "timeGridWeek", label: "Week" },
  { type: "timeGridDay", label: "Day" },
  { type: "listMonth", label: "List" },
] as const;
export type ViewType = (typeof VIEWS)[number]["type"];

/** "processing" also covers "publishing": both mean the platform is still working on it. */
export type StatusFilter = "all" | "draft" | "scheduled" | "processing" | "published" | "failed";

export const matchesStatus = (filter: StatusFilter, status: TargetStatus) =>
  filter === "all" || filter === status || (filter === "processing" && status === "publishing");

/** The time a post sits at: the publish time once sent, otherwise the planned time. */
export const whenOf = (item: FeedItem) =>
  MOVABLE.includes(item.status) ? (item.scheduledAt ?? item.publishedAt) : (item.publishedAt ?? item.scheduledAt);

/** Brand color for borders; near-black marks use the text color so they show in dark mode. */
export function platformColor(platform: Platform): string {
  const color = platforms[platform as PlatformKey]?.color;
  return !color || isNearBlack(color) ? "hsl(var(--foreground))" : color;
}

// ---- Time zones ----------------------------------------------------------------

export const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** The workspace's audience zone if it's a real IANA name, otherwise the browser's. */
export function resolveZone(zone: string | null | undefined): string {
  if (!zone) return browserZone();
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return zone;
  } catch {
    return browserZone();
  }
}

function zoneName(zone: string, style: "short" | "long"): string {
  return (
    new Intl.DateTimeFormat("en", { timeZone: zone, timeZoneName: style })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value ?? zone
  );
}

/** "East Africa Time (GMT+3)", "Eastern Standard Time (EST)". */
export const zoneLabel = (zone: string) => `${zoneName(zone, "long")} (${zoneName(zone, "short")})`;

/** "Fri 4 Dec, 9:05" in the given zone, per the copy rules. */
export const formatWhen = (date: Date, zone: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);

/** The instant a wall-clock time ("2026-12-04", 9:00) happens in `zone`. */
export function wallTime(isoDate: string, hour: number, zone: string): Date {
  const zoned = Temporal.PlainDate.from(isoDate).toZonedDateTime({ timeZone: zone, plainTime: { hour } });
  return new Date(zoned.epochMilliseconds);
}

/** Today's date in `zone`, as YYYY-MM-DD. */
export const todayIn = (zone: string) => Temporal.Now.plainDateISO(zone).toString();

/** The next whole hour at least 15 minutes from now. */
export const nextHour = () => new Date(Math.ceil((Date.now() + 15 * 60_000) / 3_600_000) * 3_600_000);

// ---- Best times ----------------------------------------------------------------

/**
 * Posting windows as weekly background events. The calendar runs in the
 * audience's zone, so the windows' audience-local times apply as they are.
 * A window that runs past midnight is split in two.
 */
export function bestTimeEvents(windows: PostingWindow[]): EventInput[] {
  const base = { groupId: "best-times", display: "background", color: "hsl(var(--primary))" };
  return windows.flatMap((w) => {
    if (w.end > w.start || w.end === "24:00") return [{ ...base, daysOfWeek: w.days, startTime: w.start, endTime: w.end }];
    return [
      { ...base, daysOfWeek: w.days, startTime: w.start, endTime: "24:00" },
      { ...base, daysOfWeek: w.days.map((d) => (d + 1) % 7), startTime: "00:00", endTime: w.end },
    ];
  });
}

// ---- Saved view and filters ------------------------------------------------------

export interface CalendarPrefs {
  view: ViewType;
  platforms: Platform[];
  accounts: string[];
  status: StatusFilter;
}

const prefsKey = (workspaceId: string) => `aby-calendar:${workspaceId}`;
const isView = (v: unknown): v is ViewType => VIEWS.some((x) => x.type === v);

/** Saved choices for this browser; phones start on the list view. */
export function loadPrefs(workspaceId: string): CalendarPrefs {
  const narrow = typeof window !== "undefined" && !window.matchMedia("(min-width: 48rem)").matches;
  const fallback: CalendarPrefs = { view: narrow ? "listMonth" : "dayGridMonth", platforms: [], accounts: [], status: "all" };
  try {
    const saved = JSON.parse(localStorage.getItem(prefsKey(workspaceId)) ?? "null") as Partial<CalendarPrefs> | null;
    if (!saved) return fallback;
    return {
      view: isView(saved.view) ? saved.view : fallback.view,
      platforms: Array.isArray(saved.platforms) ? saved.platforms : [],
      accounts: Array.isArray(saved.accounts) ? saved.accounts : [],
      status: typeof saved.status === "string" ? (saved.status as StatusFilter) : "all",
    };
  } catch {
    return fallback;
  }
}

export function savePrefs(workspaceId: string, prefs: CalendarPrefs): void {
  try {
    localStorage.setItem(prefsKey(workspaceId), JSON.stringify(prefs));
  } catch {
    // Private mode or blocked storage: the choices last for this visit only.
  }
}
