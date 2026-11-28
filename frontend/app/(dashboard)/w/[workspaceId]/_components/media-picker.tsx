"use client";

import { useRef, useState } from "react";
import { LuImagePlus, LuX } from "react-icons/lu";
import { Card, cn, ErrorNote, focusRing } from "@/app/components/ui";
import type { MediaContentType, MediaItem } from "@/app/lib/api/types";
import { inspect, prepareImage, prepareVideo, suggestFraming, type Framing, type PreparedFile } from "@/app/lib/media/prepare";
import { uploadFiles } from "@/app/lib/uploadthing";
import { MediaPrepPanel, type PendingFile, type PrepProgress } from "./media-prep-panel";
import { useWorkspace } from "./workspace-context";

// PNG is accepted and converted to JPEG before upload; TikTok takes JPEG and WebP photos.
const TYPES: Record<string, MediaItem["kind"]> = {
  "video/mp4": "video",
  "video/quicktime": "video",
  "video/webm": "video",
  "image/jpeg": "image",
  "image/webp": "image",
  "image/png": "image",
};
const MAX_IMAGES = 35;

/** A media item in the composer; `preview` is a local object URL while the page is open. */
export type DraftMedia = Omit<MediaItem, "url"> & { url: string; preview?: string };

export const toMediaBody = (media: DraftMedia[]) =>
  media.map(({ path, contentType, size, durationSec }) => ({ path, contentType, size, ...(durationSec != null && { durationSec }) }));

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/** Attach one video, or up to 35 photos, formatted for TikTok in the browser, then sent straight to UploadThing. */
export function MediaPicker({ media, onChange, disabled }: { media: DraftMedia[]; onChange: (media: DraftMedia[]) => void; disabled?: boolean }) {
  const { workspaceId } = useWorkspace();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [framing, setFraming] = useState<Framing>("fit");
  const [progress, setProgress] = useState<PrepProgress | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function choose(files: File[]) {
    setError(null);
    const kinds = files.map((f) => TYPES[f.type]);
    if (kinds.some((k) => !k)) return setError(new Error("Use MP4, MOV or WebM videos, or JPEG, PNG or WebP photos."));
    const all = [...media.map((m) => m.kind), ...kinds];
    if (all.includes("video") && all.length > 1) return setError(new Error("Add 1 video or some photos. A post can’t have both."));
    if (all.length > MAX_IMAGES) return setError(new Error(`You can add up to ${MAX_IMAGES} photos to a post.`));
    setChecking(true);
    try {
      const items = await Promise.all(files.map(async (file) => ({ file, info: await inspect(file), preview: URL.createObjectURL(file) })));
      setFraming(items.every((i) => suggestFraming(i.info) === "original") ? "original" : "fit");
      setPending(items);
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

  async function confirm() {
    setError(null);
    try {
      const prepared: PreparedFile[] = [];
      for (const [i, item] of pending.entries()) {
        const label = `Preparing ${pending.length > 1 ? `${i + 1} of ${pending.length}` : item.file.name}`;
        setProgress({ label, value: 0 });
        prepared.push(
          item.info.kind === "video"
            ? await prepareVideo(item.file, item.info, framing, (value) => setProgress({ label, value }))
            : await prepareImage(item.file, framing),
        );
      }
      const files = prepared.map((p) => p.file);
      const total = files.reduce((n, f) => n + f.size, 0);
      setProgress({ label: "Uploading", value: 0 });
      const uploaded = await uploadFiles("postMedia", {
        files,
        input: { workspaceId },
        onUploadProgress: ({ totalLoaded }) => setProgress({ label: "Uploading", value: Math.min(totalLoaded / total, 1) }),
      });
      onChange([
        ...media,
        ...uploaded.map((u, i): DraftMedia => ({
          path: u.customId ?? "",
          kind: TYPES[files[i].type],
          contentType: files[i].type as MediaContentType,
          size: files[i].size,
          durationSec: prepared[i].durationSec,
          url: u.ufsUrl,
          preview: URL.createObjectURL(files[i]),
        })),
      ]);
      cancel();
    } catch (e) {
      setError(e);
    } finally {
      setProgress(null);
    }
  }

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Media</p>
          <p className="text-xs text-muted-foreground">1 video (MP4, MOV, WebM) or up to {MAX_IMAGES} photos (JPEG, PNG, WebP). Some platforms take fewer photos or fewer formats; we check before you post.</p>
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
          disabled={disabled || checking || pending.length > 0 || media.some((m) => m.kind === "video") || media.length >= MAX_IMAGES}
          onClick={() => input.current?.click()}
          className={cn("inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9", focusRing)}
        >
          <LuImagePlus className="h-4 w-4" aria-hidden /> {checking ? "Checking…" : "Add media"}
        </button>
      </div>

      {pending.length > 0 && <MediaPrepPanel items={pending} framing={framing} onFraming={setFraming} onConfirm={confirm} onCancel={cancel} progress={progress} />}

      {media.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {media.map((m) => (
            <li key={m.path} className="relative aspect-[9/16] overflow-hidden rounded-md border border-border bg-black">
              {m.kind === "video" ? (
                <video src={m.preview ?? m.url} className="h-full w-full object-contain" muted playsInline preload="metadata" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- user uploads on a proxied origin
                <img src={m.preview ?? m.url} alt="" className="h-full w-full object-contain" />
              )}
              {m.kind === "video" && m.durationSec != null && (
                <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 text-[11px] font-semibold tabular-nums text-white">{clock(m.durationSec)}</span>
              )}
              {!disabled && (
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
