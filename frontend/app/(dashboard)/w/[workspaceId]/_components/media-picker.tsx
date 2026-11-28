"use client";

import { useEffect, useRef, useState } from "react";
import { LuImagePlus, LuX } from "react-icons/lu";
import { Card, cn, ErrorNote, focusRing, platformLabel } from "@/app/components/ui";
import type { MediaContentType, MediaItem, MediaVariant, Platform, PlatformInfo } from "@/app/lib/api/types";
import { copiesFor, type Framing, type SourceInfo } from "@/app/lib/media/plan";
import { inspect, render, toOriginal } from "@/app/lib/media/prepare";
import { uploadFiles } from "@/app/lib/uploadthing";
import { MediaPrepPanel, type PendingFile, type PrepProgress } from "./media-prep-panel";
import { useWorkspace } from "./workspace-context";

// PNG is accepted and turned into JPEG before upload.
const TYPES: Record<string, MediaItem["kind"]> = {
  "video/mp4": "video",
  "video/quicktime": "video",
  "video/webm": "video",
  "image/jpeg": "image",
  "image/webp": "image",
  "image/png": "image",
};
const MAX_IMAGES = 35;
/** UploadThing takes at most this many photos per upload. */
const UPLOAD_BATCH = 35;

/**
 * A media item in the composer. `preview` is a local object URL, `file` and
 * `info` the original as chosen; all three exist only while the page is open.
 */
export type DraftMedia = MediaItem & { preview?: string; file?: File; info?: SourceInfo; framing?: Framing };

/** What the API stores: copies only for the platforms this post goes to. */
export const toMediaBody = (media: DraftMedia[], platforms?: Platform[]) =>
  media.map(({ path, contentType, size, width, height, durationSec, variants }) => ({
    path,
    contentType,
    size,
    ...(width != null && { width }),
    ...(height != null && { height }),
    ...(durationSec != null && { durationSec }),
    variants: variants
      .filter((v) => !platforms || platforms.includes(v.platform))
      .map(({ platform, path, contentType, size, width, height }) => ({ platform, path, contentType, size, ...(width != null && { width }), ...(height != null && { height }) })),
  }));

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const list = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0]);

/** What we know about media uploaded earlier, without downloading it. MP4s are assumed to be H.264 at a usual frame rate. */
function knownInfo(m: DraftMedia): SourceInfo | null {
  if (m.info) return m.info;
  if (!m.width || !m.height) return null;
  return { kind: m.kind, contentType: m.contentType, size: m.size, width: m.width, height: m.height, durationSec: m.durationSec, fps: null, codec: m.contentType === "video/mp4" ? "avc" : null };
}

async function uploadAll(files: File[], workspaceId: string, onProgress: (p: number) => void) {
  const total = files.reduce((n, f) => n + f.size, 0) || 1;
  const done: { customId: string | null; ufsUrl: string }[] = [];
  let sent = 0;
  for (let i = 0; i < files.length; i += UPLOAD_BATCH) {
    const batch = files.slice(i, i + UPLOAD_BATCH);
    const uploaded = await uploadFiles("postMedia", {
      files: batch,
      input: { workspaceId },
      onUploadProgress: ({ totalLoaded }) => onProgress(Math.min((sent + totalLoaded) / total, 1)),
    });
    sent += batch.reduce((n, f) => n + f.size, 0);
    done.push(...uploaded);
  }
  return done;
}

/**
 * Attach one video, or up to 35 photos. Each platform the post goes to gets
 * its own copy, sized and shaped to fit it, made in the browser and uploaded
 * straight to UploadThing; platforms that can take the original share it.
 */
export function MediaPicker({
  media,
  onChange,
  platforms,
  disabled,
}: {
  media: DraftMedia[];
  onChange: (media: DraftMedia[]) => void;
  /** The platforms this post goes to. */
  platforms: PlatformInfo[];
  disabled?: boolean;
}) {
  const { workspaceId } = useWorkspace();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [framing, setFraming] = useState<Framing>("fit");
  const [progress, setProgress] = useState<PrepProgress | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const working = useRef(false);

  async function choose(files: File[]) {
    setError(null);
    const kinds = files.map((f) => TYPES[f.type]);
    if (kinds.some((k) => !k)) return setError(new Error("Use MP4, MOV or WebM videos, or JPEG, PNG or WebP photos."));
    const all = [...media.map((m) => m.kind), ...kinds];
    if (all.includes("video") && all.length > 1) return setError(new Error("Add 1 video or some photos. A post can’t have both."));
    if (all.length > MAX_IMAGES) return setError(new Error(`You can add up to ${MAX_IMAGES} photos to a post.`));
    setChecking(true);
    try {
      setPending(await Promise.all(files.map(async (file) => ({ file, info: await inspect(file), preview: URL.createObjectURL(file) }))));
    } catch (e) {
      setError(e instanceof Error ? e : new Error("We couldn’t read that file. Try another one."));
    } finally {
      setChecking(false);
    }
  }

  function cancel() {
    pending.forEach((p) => URL.revokeObjectURL(p.preview));
    setPending([]);
  }

  /** Makes and uploads the copies these items still need for `platforms`. */
  async function withCopies(items: DraftMedia[]): Promise<DraftMedia[]> {
    const result: DraftMedia[] = [];
    for (const item of items) {
      const missing = platforms.filter((p) => !item.variants.some((v) => v.platform === p.platform));
      let info = knownInfo(item);
      let source: Blob | undefined = item.file;
      let copies = info ? copiesFor(info, missing, item.framing ?? "fit") : [];
      // Earlier uploads: download only when something might need a copy, then measure for real.
      if (!item.info && (copies.length > 0 || !info) && missing.some((p) => p.media)) {
        source = await (await fetch(item.url)).blob();
        info = await inspect(source, item.contentType);
        copies = copiesFor(info, missing, item.framing ?? "fit");
      }
      if (copies.length === 0 || !info || !source) {
        result.push(item);
        continue;
      }
      const files: File[] = [];
      for (const [i, copy] of copies.entries()) {
        const label = `Preparing ${list(copy.platforms.map(platformLabel))}${copies.length > 1 ? ` (${i + 1} of ${copies.length})` : ""}`;
        setProgress({ label, value: 0 });
        files.push(await render(source, info, copy.plan, (value) => setProgress({ label, value })));
      }
      setProgress({ label: "Uploading", value: 0 });
      const uploaded = await uploadAll(files, workspaceId, (value) => setProgress({ label: "Uploading", value }));
      const variants: MediaVariant[] = copies.flatMap((copy, i) =>
        copy.platforms.map((platform) => ({
          platform,
          path: uploaded[i].customId ?? "",
          contentType: files[i].type as MediaContentType,
          size: files[i].size,
          width: copy.plan.width,
          height: copy.plan.height,
          url: uploaded[i].ufsUrl,
        })),
      );
      result.push({ ...item, info, variants: [...item.variants, ...variants] });
    }
    return result;
  }

  async function confirm() {
    setError(null);
    working.current = true;
    try {
      const originals = [];
      for (const p of pending) originals.push(await toOriginal(p.file, p.info));
      setProgress({ label: "Uploading", value: 0 });
      const uploaded = await uploadAll(originals.map((o) => o.file), workspaceId, (value) => setProgress({ label: "Uploading", value }));
      const items: DraftMedia[] = originals.map(({ file, info }, i) => ({
        path: uploaded[i].customId ?? "",
        kind: info.kind,
        contentType: file.type as MediaContentType,
        size: file.size,
        width: info.width,
        height: info.height,
        durationSec: info.durationSec,
        url: uploaded[i].ufsUrl,
        variants: [],
        preview: URL.createObjectURL(file),
        file,
        info,
        framing,
      }));
      onChange([...media, ...(await withCopies(items))]);
      cancel();
    } catch (e) {
      setError(e);
    } finally {
      working.current = false;
      setProgress(null);
    }
  }

  // When the post gains a platform, make the copies it needs from media already attached.
  const platformKey = platforms.map((p) => p.platform).sort().join();
  useEffect(() => {
    if (disabled || working.current || media.length === 0 || platforms.length === 0) return;
    const needsWork = media.some((m) => {
      const missing = platforms.filter((p) => p.media && !m.variants.some((v) => v.platform === p.platform));
      if (missing.length === 0) return false;
      const info = knownInfo(m);
      return !info || copiesFor(info, missing, m.framing ?? "fit").length > 0;
    });
    if (!needsWork) return;
    // Waits a moment, so ticking several accounts in a row prepares once.
    const timer = setTimeout(() => {
      if (working.current) return;
      working.current = true;
      withCopies(media)
        .then((updated) => onChange(updated))
        .catch((e: unknown) => setError(e))
        .finally(() => {
          working.current = false;
          setProgress(null);
        });
    }, 400);
    return () => clearTimeout(timer);
    // Runs when the set of platforms or attached files changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platformKey, media.map((m) => m.path).join(), disabled]);

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Media</p>
          <p className="text-xs text-muted-foreground">1 video (MP4, MOV, WebM) or up to {MAX_IMAGES} photos (JPEG, PNG, WebP). Each platform gets a copy sized for it.</p>
        </div>
        <input
          ref={input}
          type="file"
          className="sr-only"
          accept={Object.keys(TYPES).join(",")}
          multiple
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            if (files.length) void choose(files);
          }}
        />
        <button
          type="button"
          disabled={disabled || checking || pending.length > 0 || progress !== null || media.some((m) => m.kind === "video") || media.length >= MAX_IMAGES}
          onClick={() => input.current?.click()}
          className={cn("inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9", focusRing)}
        >
          <LuImagePlus className="h-4 w-4" aria-hidden /> {checking ? "Checking…" : "Add media"}
        </button>
      </div>

      {pending.length > 0 && <MediaPrepPanel items={pending} platforms={platforms} framing={framing} onFraming={setFraming} onConfirm={confirm} onCancel={cancel} progress={progress} />}
      {pending.length === 0 && progress && (
        <div className="space-y-1" role="status">
          <p className="text-xs font-medium text-foreground">{progress.label} · {Math.round(progress.value * 100)}%</p>
          <span className="block h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <span className="block h-full bg-primary transition-[width]" style={{ width: `${progress.value * 100}%` }} />
          </span>
        </div>
      )}

      {media.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {media.map((m) => (
            <li key={m.path} className="relative overflow-hidden rounded-md border border-border bg-black" style={{ aspectRatio: m.width && m.height ? `${m.width} / ${m.height}` : "1 / 1" }}>
              {m.kind === "video" ? (
                <video src={m.preview ?? m.url} className="h-full w-full object-contain" muted playsInline preload="metadata" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- user uploads on a proxied origin
                <img src={m.preview ?? m.url} alt="" className="h-full w-full object-contain" />
              )}
              {m.kind === "video" && m.durationSec != null && (
                <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 text-[11px] font-semibold tabular-nums text-white">{clock(m.durationSec)}</span>
              )}
              {!disabled && progress === null && (
                <button
                  type="button"
                  aria-label={m.kind === "video" ? "Remove video" : "Remove photo"}
                  onClick={() => onChange(media.filter((x) => x.path !== m.path))}
                  className={cn("absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-full bg-black/70 text-white", focusRing)}
                >
                  <LuX className="h-4 w-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <ErrorNote error={error} />
    </Card>
  );
}
