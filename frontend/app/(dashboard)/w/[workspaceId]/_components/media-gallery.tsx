"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/app/components/ui";
import { useApi } from "@/app/lib/api/client";
import type { MediaVariant, Platform, PlatformInfo } from "@/app/lib/api/types";
import { clock } from "@/app/lib/format";

/** One photo or video as a platform shows it. */
export interface GalleryFile {
  kind: "image" | "video";
  url: string;
  width: number | null;
  height: number | null;
  durationSec: number | null;
}

/** A post's media before picking a platform's copy; local drafts carry a `preview` object URL. */
export interface PreviewMedia extends GalleryFile {
  preview?: string;
  variants?: MediaVariant[];
}

/** The file each item sends to `platform`: its own copy, or the original. */
export function filesFor(media: PreviewMedia[], platform: Platform): GalleryFile[] {
  return media.map(({ kind, durationSec, url, width, height, preview, variants }) => {
    const variant = variants?.find((v) => v.platform === platform);
    if (variant) return { kind, durationSec, url: variant.url, width: variant.width, height: variant.height };
    return { kind, durationSec, url: preview ?? url, width, height };
  });
}

/** Whether a platform posts media; true until the platform list loads so cards don’t jump. */
export function useTakesMedia(platform: Platform): boolean {
  const { data } = useApi<PlatformInfo[]>("/integrations");
  return !data || Boolean(data.find((c) => c.platform === platform)?.media);
}

type Layout = "grid" | "mosaic" | "vertical";

const STYLE: Record<Platform, { layout: Layout; frame: string }> = {
  x: { layout: "grid", frame: "rounded-2xl border border-border" },
  bluesky: { layout: "grid", frame: "rounded-xl border border-border" },
  mastodon: { layout: "grid", frame: "rounded-lg border border-border" },
  discord: { layout: "grid", frame: "max-w-md rounded-md" },
  linkedin: { layout: "mosaic", frame: "rounded-md" },
  telegram: { layout: "mosaic", frame: "rounded-xl" },
  tiktok: { layout: "vertical", frame: "mx-auto max-w-72 rounded-lg" },
};

const BADGE = "pointer-events-none absolute rounded bg-black/70 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-white";
const COLS = ["grid-cols-1", "grid-cols-2", "grid-cols-3"];

const ratio = (f: GalleryFile) => (f.width && f.height ? f.width / f.height : 16 / 9);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function describe(files: GalleryFile[]) {
  const videos = files.filter((f) => f.kind === "video");
  const photos = files.length - videos.length;
  const parts = [];
  if (videos.length === 1) parts.push(videos[0].durationSec ? `Video, ${clock(videos[0].durationSec)}` : "Video");
  else if (videos.length > 1) parts.push(plural(videos.length, "video"));
  if (photos > 0) parts.push(plural(photos, "photo"));
  return parts.join(" and ");
}

/** Photos and videos laid out the way `platform` shows them in its feed. */
export function MediaGallery({ files, platform, className }: { files: GalleryFile[]; platform: Platform; className?: string }) {
  if (files.length === 0) return null;
  const { layout, frame } = STYLE[platform];
  return (
    <div role="group" aria-label={describe(files)} className={cn("overflow-hidden", frame, className)}>
      {layout === "vertical" ? <Vertical files={files} /> : files.length === 1 ? <Single file={files[0]} /> : layout === "grid" ? <Grid files={files} /> : <Mosaic files={files} />}
    </div>
  );
}

// Very tall media is letterboxed at 4:5 so it doesn’t dominate the card.
function Single({ file }: { file: GalleryFile }) {
  return <Tile file={file} fit="contain" className="bg-black" style={{ aspectRatio: Math.max(ratio(file), 0.8) }} />;
}

function Grid({ files }: { files: GalleryFile[] }) {
  const shown = files.slice(0, 4);
  return (
    <div className={cn("grid aspect-video grid-cols-2 gap-0.5", shown.length > 2 ? "grid-rows-2" : "grid-rows-1")}>
      {shown.map((f, i) => (
        <Tile
          key={`${f.url}-${i}`}
          file={f}
          fit="cover"
          className={cn(shown.length === 3 && i === 0 && "row-span-2")}
          extra={i === shown.length - 1 ? files.length - shown.length : 0}
        />
      ))}
    </div>
  );
}

function Mosaic({ files }: { files: GalleryFile[] }) {
  const [first, ...rest] = files;
  const below = rest.slice(0, 3);
  return (
    <div className="flex flex-col gap-0.5">
      <Tile file={first} fit="cover" style={{ aspectRatio: Math.min(Math.max(ratio(first), 0.8), 1.91) }} />
      <div className={cn("grid gap-0.5", COLS[below.length - 1])}>
        {below.map((f, i) => (
          <Tile
            key={`${f.url}-${i}`}
            file={f}
            fit="cover"
            className={below.length === 1 ? "aspect-video" : "aspect-square"}
            extra={i === below.length - 1 ? rest.length - below.length : 0}
          />
        ))}
      </div>
    </div>
  );
}

// TikTok shows one item at a time in a 9:16 frame; photo posts swipe through the rest.
function Vertical({ files }: { files: GalleryFile[] }) {
  return (
    <Tile file={files[0]} fit="contain" className="aspect-[9/16] bg-black">
      {files.length > 1 && <span aria-hidden className={cn(BADGE, "right-2 top-2")}>1/{files.length}</span>}
    </Tile>
  );
}

function Tile({
  file,
  fit,
  extra = 0,
  className,
  style,
  children,
}: {
  file: GalleryFile;
  fit: "cover" | "contain";
  extra?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const media = cn("absolute inset-0 h-full w-full", fit === "cover" ? "object-cover" : "object-contain");
  return (
    <div className={cn("relative min-h-0 overflow-hidden bg-muted", className)} style={style}>
      {file.kind === "video" ? (
        <video src={file.url} className={media} controls playsInline muted preload="metadata" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- user uploads on a proxied origin
        <img src={file.url} alt="" loading="lazy" className={media} />
      )}
      {file.kind === "video" && file.durationSec ? <span aria-hidden className={cn(BADGE, "left-2 top-2")}>{clock(file.durationSec)}</span> : null}
      {extra > 0 && (
        <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/55 text-2xl font-semibold text-white">
          +{extra}
        </span>
      )}
      {children}
    </div>
  );
}
