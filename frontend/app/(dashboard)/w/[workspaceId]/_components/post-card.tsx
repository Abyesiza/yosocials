"use client";

import Link from "next/link";
import type { IconType } from "react-icons";
import { LuExternalLink, LuHeart, LuMessageCircle, LuQuote, LuRepeat2 } from "react-icons/lu";
import { Avatar, Card, cn, focusRing, PlatformIcon, platformLabel, StatusBadge } from "@/app/components/ui";
import type { FeedItem } from "@/app/lib/api/types";
import { compact, timeAgo } from "@/app/lib/format";
import { MediaGallery, useTakesMedia } from "./media-gallery";
import { useWorkspace } from "./workspace-context";

export function PostCard({ item }: { item: FeedItem }) {
  const { href } = useWorkspace();
  const { account, metrics } = item;
  const takesMedia = useTakesMedia(account.platform);

  return (
    <Card className="flex flex-col p-5 transition-shadow hover:shadow-md">
      <header className="flex items-center gap-3">
        <span className="relative">
          <Avatar name={account.displayName} src={account.avatarUrl} size={40} ring />
          <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-card p-0.5">
            <PlatformIcon platform={account.platform} size={13} />
          </span>
        </span>
        <div className="min-w-0 flex-1 text-sm">
          <p className="truncate font-semibold text-foreground">
            {account.displayName}
            <span className="font-normal text-muted-foreground"> · {timeAgo(item.publishedAt ?? item.scheduledAt)}</span>
          </p>
          <p className="truncate text-xs text-muted-foreground">{account.handle}</p>
        </div>
        {item.status !== "published" && <StatusBadge status={item.status} />}
      </header>

      <Link
        href={href(`/posts/${item.postId}`)}
        className={cn("mt-4 block flex-1 rounded-sm", focusRing)}
      >
        <p className="line-clamp-6 whitespace-pre-wrap break-words text-[15px] leading-6 text-foreground">
          {item.text}
        </p>
      </Link>
      {takesMedia && <MediaGallery files={item.media} platform={account.platform} className="mt-3" />}

      {item.status === "published" && (
        <footer className="mt-4 flex items-center gap-5 border-t border-border pt-3 text-sm text-foreground">
          <Metric Icon={LuHeart} value={metrics.likes} label="likes" />
          <Metric Icon={LuRepeat2} value={metrics.reposts} label="reposts" />
          <Metric Icon={LuMessageCircle} value={metrics.replies} label="replies" />
          <Metric Icon={LuQuote} value={metrics.quotes} label="quotes" />
          {item.externalUrl && (
            <a
              href={item.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`View on ${platformLabel(account.platform)}`}
              className={cn("ml-auto flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground sm:h-8 sm:w-8", focusRing)}
            >
              <LuExternalLink className="h-4 w-4" />
            </a>
          )}
        </footer>
      )}
      {item.lastError && item.status !== "published" && (
        <p className="mt-3 text-xs text-destructive">{item.lastError}</p>
      )}
    </Card>
  );
}

// Platforms that don't report a number get no icon rather than a fake 0.
function Metric({ Icon, value, label }: { Icon: IconType; value: number | null; label: string }) {
  if (value === null) return null;
  return (
    <span className="flex items-center gap-1.5" title={`${value} ${label}`}>
      <Icon className="h-[18px] w-[18px]" aria-hidden />
      <span className="font-semibold tabular-nums">{compact(value)}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
