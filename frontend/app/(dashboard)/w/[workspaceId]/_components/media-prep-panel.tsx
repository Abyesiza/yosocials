"use client";

import { Button, Card, Chip, cn } from "@/app/components/ui";
import { TARGET, type Framing, type MediaInfo } from "@/app/lib/media/prepare";

export interface PendingFile {
  file: File;
  info: MediaInfo;
  preview: string;
}

export interface PrepProgress {
  label: string;
  /** 0 to 1. */
  value: number;
}

const FRAMINGS: { value: Framing; label: string; hint: string }[] = [
  { value: "fit", label: "Fit", hint: "Shows the whole picture on a blurred backdrop. Nothing is cut off." },
  { value: "fill", label: "Fill", hint: "Fills the vertical frame; the edges are cropped." },
  { value: "original", label: "Original", hint: "Keeps the shape and only shrinks it to TikTok’s limits. TikTok may add bars." },
];

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

function describe({ info }: PendingFile, framing: Framing): string {
  const source = [`${info.width}×${info.height}`, info.fps && `${Math.round(info.fps)} fps`, info.durationSec && clock(info.durationSec)].filter(Boolean).join(" · ");
  if (framing === "original" && info.ready) return `${source} · ready for TikTok as it is`;
  const out = framing === "original" ? "resized to TikTok’s limits" : `${TARGET.width}×${TARGET.height}`;
  return `${source} → ${out}, ${info.kind === "video" ? "H.264 MP4" : "JPEG"}`;
}

/** The look of each framing, previewed with CSS before anything is encoded. */
function Preview({ item, framing }: { item: PendingFile; framing: Framing }) {
  const media = (className: string) =>
    item.info.kind === "video" ? (
      <video src={item.preview} className={className} muted playsInline autoPlay loop />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element -- local object URL
      <img src={item.preview} alt="" className={className} />
    );
  return (
    <div className="relative aspect-[9/16] w-full overflow-hidden rounded-md border border-border bg-black">
      {framing === "fit" && media("absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-xl")}
      {media(cn("relative h-full w-full", framing === "fill" ? "object-cover" : "object-contain"))}
    </div>
  );
}

/** Between picking files and uploading them: choose how they're framed for TikTok's vertical format. */
export function MediaPrepPanel({
  items,
  framing,
  onFraming,
  onConfirm,
  onCancel,
  progress,
}: {
  items: PendingFile[];
  framing: Framing;
  onFraming: (f: Framing) => void;
  onConfirm: () => void;
  onCancel: () => void;
  progress: PrepProgress | null;
}) {
  const busy = progress !== null;
  return (
    <Card className="space-y-4 border-primary/40 p-4">
      <div>
        <p className="text-sm font-semibold text-foreground">Format for TikTok</p>
        <p className="text-xs text-muted-foreground">TikTok works best with vertical {TARGET.width}×{TARGET.height} (9:16). Files are prepared in your browser before uploading.</p>
      </div>
      <fieldset disabled={busy} className="space-y-2">
        <legend className="sr-only">Framing</legend>
        <div className="flex flex-wrap gap-2">
          {FRAMINGS.map((f) => (
            <Chip key={f.value} active={framing === f.value} onClick={() => onFraming(f.value)}>{f.label}</Chip>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{FRAMINGS.find((f) => f.value === framing)?.hint}</p>
      </fieldset>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <li key={item.preview} className="space-y-1.5">
            <Preview item={item} framing={framing} />
            <p className="text-[11px] leading-4 text-muted-foreground">{describe(item, framing)}</p>
          </li>
        ))}
      </ul>
      {progress && (
        <div className="space-y-1" role="status">
          <p className="text-xs font-medium text-foreground">{progress.label} · {Math.round(progress.value * 100)}%</p>
          <span className="block h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <span className="block h-full bg-primary transition-[width]" style={{ width: `${progress.value * 100}%` }} />
          </span>
        </div>
      )}
      <div className="flex gap-2">
        <Button size="sm" onClick={onConfirm} loading={busy}>Prepare and upload</Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
      </div>
    </Card>
  );
}
