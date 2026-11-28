"use client";

import FullCalendar, {
  useCalendarController,
  type AllowFunc,
  type DateClickInfo,
  type DatesSetInfo,
  type EventClickInfo,
  type EventDropInfo,
  type EventInput,
} from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import listPlugin from "@fullcalendar/react/list";
import enGb from "@fullcalendar/react/locales/en-gb";
import breezyTheme from "@fullcalendar/react/themes/breezy";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/breezy/theme.css";
import "./calendar.css";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, ErrorNote, platformLabel } from "@/app/components/ui";
import { api, useApi } from "@/app/lib/api/client";
import type { Account, FeedItem, PlatformInfo } from "@/app/lib/api/types";
import { eventClass, renderEvent } from "./calendar-event";
import { CalendarFilters } from "./calendar-filters";
import { CalendarToolbar } from "./calendar-toolbar";
import {
  bestTimeEvents, formatWhen, loadPrefs, matchesStatus, MOVABLE, nextHour, platformColor,
  resolveZone, savePrefs, todayIn, wallTime, whenOf, zoneLabel, type CalendarPrefs, type ViewType,
} from "./calendar-utils";
import { useWorkspace } from "./workspace-context";

const PLUGINS = [breezyTheme, dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin];
const TIME_FORMAT = { hour: "numeric", minute: "2-digit", hourCycle: "h23" } as const;
const PERIOD: Record<ViewType, string> = { dayGridMonth: "month", timeGridWeek: "week", timeGridDay: "day", listMonth: "month" };
const isMovable = (item: FeedItem | undefined) => Boolean(item && MOVABLE.includes(item.status));

export default function ContentCalendar() {
  const { base, href, can, workspaceId, workspace } = useWorkspace();
  const router = useRouter();
  const controller = useCalendarController();
  const [prefs, setPrefs] = useState<CalendarPrefs>(() => loadPrefs(workspaceId));
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [notice, setNotice] = useState<{ error?: string; done?: string }>({});
  const zone = useMemo(() => resolveZone(workspace?.audienceTimeZone), [workspace?.audienceTimeZone]);
  const canEdit = can("editor");

  useEffect(() => savePrefs(workspaceId, prefs), [workspaceId, prefs]);

  const key = range ? `${base}/calendar?${new URLSearchParams(range)}` : null;
  const { data, error, isLoading, mutate } = useApi<FeedItem[]>(key, { keepPreviousData: true });
  const { data: accounts } = useApi<Account[]>(`${base}/accounts`);
  const { data: caps } = useApi<PlatformInfo[]>("/integrations");

  const visible = useMemo(
    () => (data ?? []).filter((i) =>
      (!prefs.platforms.length || prefs.platforms.includes(i.account.platform)) &&
      (!prefs.accounts.length || prefs.accounts.includes(i.account.id)) &&
      matchesStatus(prefs.status, i.status)),
    [data, prefs.platforms, prefs.accounts, prefs.status],
  );

  const onlyPlatform = prefs.platforms.length === 1 ? prefs.platforms[0] : null;
  const showBest = Boolean(onlyPlatform) && prefs.view.startsWith("timeGrid");
  const windows = caps?.find((c) => c.platform === onlyPlatform)?.posting.windows;

  const events = useMemo<EventInput[]>(() => {
    const posts = visible.flatMap((item): EventInput[] => {
      const start = whenOf(item);
      if (!start) return [];
      return [{
        id: item.id, start, allDay: false, title: item.text, url: href(`/posts/${item.postId}`),
        color: platformColor(item.account.platform), startEditable: canEdit && isMovable(item), durationEditable: false,
        extendedProps: { item },
      }];
    });
    return showBest && windows ? [...bestTimeEvents(windows), ...posts] : posts;
  }, [visible, href, canEdit, showBest, windows]);

  const onDatesSet = useCallback((info: DatesSetInfo) => {
    const next = { from: info.start.toISOString(), to: info.end.toISOString() };
    setRange((r) => (r?.from === next.from && r.to === next.to ? r : next));
  }, []);

  const onView = useCallback((view: ViewType) => {
    controller.changeView(view);
    setPrefs((p) => ({ ...p, view }));
  }, [controller]);

  const eventAllow = useCallback<AllowFunc>(
    (span, moving) => span.start.getTime() > Date.now() && isMovable(moving?.extendedProps.item as FeedItem | undefined),
    [],
  );

  const onEventDrop = useCallback(async (info: EventDropInfo) => {
    const item = info.event.extendedProps.item as FeedItem;
    const start = info.event.start;
    if (!start) return info.revert();
    const scheduledAt = start.toISOString();
    setNotice({});
    try {
      await api(`${base}/posts/${item.postId}/targets/${item.id}`, { method: "PATCH", body: { scheduledAt } });
      setNotice({ done: `Moved to ${formatWhen(start, zone)}.` });
      await mutate((list) => list?.map((i) => (i.id === item.id ? { ...i, scheduledAt } : i)));
    } catch (err) {
      info.revert();
      setNotice({ error: err instanceof Error ? err.message : "We couldn’t move this post. Try again in a moment." });
    }
  }, [base, zone, mutate]);

  const onEventClick = useCallback((info: EventClickInfo) => {
    const e = info.jsEvent;
    if (!info.event.url || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
    e.preventDefault();
    router.push(info.event.url);
  }, [router]);

  const onDateClick = useCallback((info: DateClickInfo) => {
    if (!canEdit) return;
    let at = info.date;
    if (info.allDay) {
      const day = info.dateStr.slice(0, 10);
      if (day < todayIn(zone)) return;
      at = wallTime(day, 9, zone);
      if (at.getTime() <= Date.now()) at = nextHour();
    } else if (at.getTime() <= Date.now()) return;
    router.push(href(`/create?at=${encodeURIComponent(at.toISOString())}`));
  }, [canEdit, zone, router, href]);

  const emptyText = `No posts this ${PERIOD[prefs.view]}.`;
  const empty = Boolean(data) && visible.length === 0;
  const filtered = prefs.platforms.length > 0 || prefs.accounts.length > 0 || prefs.status !== "all";

  return (
    <div>
      {accounts && <CalendarFilters accounts={accounts} value={prefs} onChange={(f) => setPrefs((p) => ({ ...p, ...f }))} />}
      <CalendarToolbar controller={controller} view={prefs.view} onView={onView} zone={zoneLabel(zone)} loading={isLoading} />

      <div className="mb-4 space-y-2 empty:hidden">
        <ErrorNote error={error} />
        {notice.error && (
          <div className="flex items-start gap-2">
            <div className="flex-1"><ErrorNote error={notice.error} /></div>
            <Button variant="ghost" size="sm" onClick={() => setNotice({})}>Dismiss</Button>
          </div>
        )}
        {notice.done && <p role="status" className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">{notice.done}</p>}
        {showBest && windows && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <span aria-hidden className="h-3 w-5 rounded-sm bg-primary/20" />
            Best times on {platformLabel(onlyPlatform!)} (audience time)
          </p>
        )}
        {empty && !prefs.view.startsWith("list") && (
          <p className="text-sm text-muted-foreground">
            {emptyText} {filtered ? "Clear the filters to see more." : canEdit ? "Click a day or time to create a post there." : ""}
          </p>
        )}
      </div>

      <Card className="aby-cal overflow-hidden p-2 sm:p-4" aria-busy={isLoading}>
        <FullCalendar
          controller={controller}
          plugins={PLUGINS}
          locale={enGb}
          timeZone={zone}
          initialView={prefs.view}
          headerToolbar={false}
          height={prefs.view.startsWith("timeGrid") ? 760 : "auto"}
          events={events}
          datesSet={onDatesSet}
          eventContent={renderEvent}
          eventClass={eventClass}
          popoverClass="aby-cal-popover"
          eventTimeFormat={TIME_FORMAT}
          slotHeaderFormat={TIME_FORMAT}
          dayHeaderFormat={{ weekday: "short", day: "numeric" }}
          dayMaxEvents
          moreLinkText={(n) => `+${n} more`}
          moreLinkHint={(n) => `Show ${n} more ${n === 1 ? "post" : "posts"}`}
          noEventsText={filtered ? `${emptyText} Clear the filters to see more.` : `${emptyText} Create a post to fill it.`}
          allDaySlot={false}
          nowIndicator
          scrollTime="07:00:00"
          defaultTimedEventDuration="00:30"
          eventInteractive
          editable={canEdit}
          eventDurationEditable={false}
          eventAllow={eventAllow}
          eventDrop={onEventDrop}
          eventClick={onEventClick}
          dateClick={onDateClick}
        />
      </Card>
    </div>
  );
}
