"use client";

import { useRef, useState } from "react";
import { LuImagePlus, LuX } from "react-icons/lu";
import { Card, cn, ErrorNote, focusRing } from "@/app/components/ui";
import { api } from "@/app/lib/api/client";
import type { MediaContentType, MediaItem, UploadTicket } from "@/app/lib/api/types";
import { useWorkspace } from "./workspace-context";

const TYPES: Record<string, MediaItem["kind"]> = {
  "video/mp4": "video",
  "video/quicktime": "video",
  "video/webm": "video",
  "image/jpeg": "image",
  "image/webp": "image",
};
const MAX_IMAGES = 35;

/** A media item in the composer; `preview` is a local object URL while the page is open. */
export type DraftMedia = Omit<MediaItem, "url"> & { url: string; preview?: string };

export const toMediaBody = (media: DraftMedia[]) =>
  media.map(({ path, contentType, size, durationSec }) => ({ path, contentType, size, ...(durationSec != null && { durationSec }) }));

function videoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(video.duration) ? video.duration : null);
    };
    video.onerror = () => resolve(null);
    video.src = url;
  });
}

// fetch can't report upload progress; XHR can.
function put(url: string, file: File, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", file.type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status}). Try again.`)));
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
    xhr.send(file);
  });
}

/** Attach one video, or up to 35 photos. Files go straight to storage, never through our servers. */
export function MediaPicker({ media, onChange, disabled }: { media: DraftMedia[]; onChange: (media: DraftMedia[]) => void; disabled?: boolean }) {
  const { base } = useWorkspace();
  const input = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<Record<string, number>>({});
  const [error, setError] = useState<unknown>(null);
  const busy = Object.keys(uploads).length > 0;

  async function add(files: File[]) {
    setError(null);
    const kinds = files.map((f) => TYPES[f.type]);
    if (kinds.some((k) => !k)) return setError(new Error("Use MP4, MOV or WebM videos, or JPEG or WebP photos."));
    const all = [...media.map((m) => m.kind), ...kinds];
    if (all.includes("video") && all.length > 1) return setError(new Error("Attach one video, or photos only. Videos and photos can’t be mixed."));
    if (all.length > MAX_IMAGES) return setError(new Error(`Attach up to ${MAX_IMAGES} photos.`));

    let next = media;
    for (const file of files) {
      const id = `${file.name}-${file.size}-${file.lastModified}`;
      setUploads((u) => ({ ...u, [id]: 0 }));
      try {
        const kind = TYPES[file.type];
        const durationSec = kind === "video" ? await videoDuration(file) : null;
        const ticket = await api<UploadTicket>(`${base}/media/uploads`, { body: { contentType: file.type, size: file.size } });
        await put(ticket.uploadUrl, file, (p) => setUploads((u) => ({ ...u, [id]: p })));
        next = [...next, { path: ticket.path, kind, contentType: file.type as MediaContentType, size: file.size, durationSec, url: ticket.publicUrl, preview: URL.createObjectURL(file) }];
        onChange(next);
      } catch (e) {
        setError(e);
      } finally {
        setUploads((u) => Object.fromEntries(Object.entries(u).filter(([key]) => key !== id)));
      }
    }
  }

  const progress = Object.values(uploads);
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Media</p>
          <p className="text-xs text-muted-foreground">One video (MP4, MOV, WebM) or up to {MAX_IMAGES} photos (JPEG, WebP). TikTok needs one or the other.</p>
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
            if (files.length) void add(files);
          }}
        />
        <button
          type="button"
          disabled={disabled || busy || media.some((m) => m.kind === "video") || media.length >= MAX_IMAGES}
          onClick={() => input.current?.click()}
          className={cn("inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9", focusRing)}
        >
          <LuImagePlus className="h-4 w-4" aria-hidden /> Add media
        </button>
      </div>

      {(media.length > 0 || progress.length > 0) && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {media.map((m) => (
            <li key={m.path} className="group relative aspect-square overflow-hidden rounded-md border border-border bg-muted">
              {m.kind === "video" ? (
                <video src={m.preview ?? m.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- user uploads on a proxied origin
                <img src={m.preview ?? m.url} alt="" className="h-full w-full object-cover" />
              )}
              {m.kind === "video" && m.durationSec != null && (
                <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 text-[11px] font-semibold tabular-nums text-white">
                  {Math.floor(m.durationSec / 60)}:{String(Math.round(m.durationSec % 60)).padStart(2, "0")}
                </span>
              )}
              {!disabled && (
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() => onChange(media.filter((x) => x.path !== m.path))}
                  className={cn("absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-full bg-black/70 text-white", focusRing)}
                >
                  <LuX className="h-4 w-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
          {progress.map((p, i) => (
            <li key={`upload-${i}`} className="flex aspect-square flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border p-3">
              <span className="text-xs font-semibold tabular-nums text-muted-foreground">{Math.round(p * 100)}%</span>
              <span className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Uploading" aria-valuenow={Math.round(p * 100)} aria-valuemin={0} aria-valuemax={100}>
                <span className="block h-full bg-primary transition-[width]" style={{ width: `${p * 100}%` }} />
              </span>
            </li>
          ))}
        </ul>
      )}
      <ErrorNote error={error} />
    </Card>
  );
}
