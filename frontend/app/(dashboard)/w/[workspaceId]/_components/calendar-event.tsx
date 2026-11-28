"use client";

import type { EventDisplayInfo } from "@fullcalendar/react";
import type { IconType } from "react-icons";
import { LuCircleAlert, LuCircleCheck, LuClock, LuHourglass, LuPencilLine, LuVideo } from "react-icons/lu";
import { Avatar, cn, PlatformIcon, platformLabel, StatusBadge } from "@/app/components/ui";
import type { FeedItem, TargetStatus } from "@/app/lib/api/types";

const STATUS: Record<TargetStatus, { label: string; Icon: IconType; className: string }> = {
  draft: { label: "Draft", Icon: LuPencilLine, className: "text-muted-foreground" },
  scheduled: { label: "Scheduled", Icon: LuClock, className: "text-primary" },
  publishing: { label: "Publishing", Icon: LuHourglass, className: "text-warning" },
  processing: { label: "Processing", Icon: LuHourglass, className: "text-warning" },
  published: { label: "Published", Icon: LuCircleCheck, className: "text-success" },
  failed: { label: "Failed", Icon: LuCircleAlert, className: "text-destructive" },
};

/** Status as an icon plus a label for screen readers, so it never relies on colour. */
function StatusIcon({ status }: { status: TargetStatus }) {
  const { label, Icon, className } = STATUS[status];
  return (
    <>
      <Icon className={cn("h-3 w-3 shrink-0", className)} aria-hidden />
      <span className="sr-only">{label}.</span>
    </>
  );
}

const textOf = (item: FeedItem) => item.text || item.postTitle || "No text";

function MonthEvent({ item, time }: { item: FeedItem; time: string }) {
  return (
    <span className="flex w-full min-w-0 items-center gap-1 px-0.5 text-xs leading-5">
      <PlatformIcon platform={item.account.platform} size={12} />
      <span className="shrink-0 tabular-nums text-muted-foreground">{time}</span>
      <StatusIcon status={item.status} />
      <span className="sr-only">{item.account.displayName}:</span>
      <span className="min-w-0 truncate text-foreground">{textOf(item)}</span>
    </span>
  );
}

function TimeGridEvent({ item, time }: { item: FeedItem; time: string }) {
  return (
    <span className="flex h-full w-full min-w-0 items-start gap-1.5 overflow-hidden px-1.5 py-1 text-xs leading-4">
      <Avatar name={item.account.displayName} src={item.account.avatarUrl} size={18} />
      <span className="mt-px shrink-0"><PlatformIcon platform={item.account.platform} size={12} /></span>
      <StatusIcon status={item.status} />
      <span className="sr-only">{time}, {item.account.displayName}:</span>
      <span className="min-w-0 truncate text-foreground">{textOf(item)}</span>
    </span>
  );
}

function ListEvent({ item, time }: { item: FeedItem; time: string }) {
  const media = item.media[0];
  return (
    <span className="flex w-full min-w-0 items-start gap-3 py-0.5">
      <span className="w-12 shrink-0 pt-0.5 text-sm tabular-nums text-muted-foreground">{time}</span>
      {media && (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
          {media.kind === "image" ? (
            // Thumbnails come from our media host at their stored size; next/image would resize every one.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={media.url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
          ) : (
            <LuVideo className="h-5 w-5 text-muted-foreground" aria-label="Video" />
          )}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-foreground">
          <PlatformIcon platform={item.account.platform} size={14} />
          <span className="truncate">{item.account.displayName}</span>
          <span className="truncate font-normal text-muted-foreground">@{item.account.handle.replace(/^@/, "")}</span>
          <span className="sr-only">on {platformLabel(item.account.platform)}</span>
        </span>
        <span className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{textOf(item)}</span>
      </span>
      <span className="shrink-0"><StatusBadge status={item.status} /></span>
    </span>
  );
}

/** One post on the calendar, laid out for the view it's in. */
export function renderEvent(info: EventDisplayInfo) {
  const item = info.event.extendedProps.item as FeedItem | undefined;
  if (!item) return null;
  const type = info.view.type;
  if (type.startsWith("list")) return <ListEvent item={item} time={info.timeText} />;
  if (type.startsWith("timeGrid")) return <TimeGridEvent item={item} time={info.timeText} />;
  return <MonthEvent item={item} time={info.timeText} />;
}

export const eventClass = (info: EventDisplayInfo) =>
  info.event.display !== "background" && info.view.type.startsWith("timeGrid") ? "aby-cal-block" : "";
