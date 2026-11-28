"use client";

import { Button, Card, Chip, cn, platformLabel } from "@/app/components/ui";
import type { Platform, PlatformInfo } from "@/app/lib/api/types";
import { copiesFor, framingMatters, type Framing, type Plan, type SourceInfo } from "@/app/lib/media/plan";

export interface PendingFile {
  file: File;
  info: SourceInfo;
  preview: string;
}

export interface PrepProgress {
  label: string;
  /** 0 to 1. */
  value: number;
}

const FRAMINGS: { value: Framing; label: string; hint: string }[] = [
  { value: "fit", label: "Fit", hint: "Shows the whole picture on a blurred backdrop where a platform wants another shape. Nothing is cut off." },
  { value: "fill", label: "Fill", hint: "Fills each platform’s preferred shape; the edges are cropped." },
  { value: "original", label: "Original", hint: "Keeps your shape wherever a platform allows it. TikTok may add bars." },
];

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const list = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0]);

/** What each platform gets from one file: a shared original, or copies of a given size and shape. */
function outcomes(info: SourceInfo, platforms: PlatformInfo[], framing: Framing) {
  const takes = platforms.filter((p) => (info.kind === "video" ? p.media?.videoSpec : p.media?.imageSpec));
  const copies = copiesFor(info, takes, framing);
  const copied = new Set(copies.flatMap((c) => c.platforms));
  const asIs = takes.filter((p) => !copied.has(p.platform)).map((p) => p.platform);
  return { copies, asIs };
}

/** A copy's look, previewed with CSS before anything is encoded. */
function Preview({ item, plan }: { item: PendingFile; plan: Pick<Plan, "width" | "height" | "reshape"> }) {
  const media = (className: string) =>
    item.info.kind === "video" ? (
      <video src={item.preview} className={className} muted playsInline autoPlay loop />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element -- local object URL
      <img src={item.preview} alt="" className={className} />
    );
  return (
    <div className="relative w-full overflow-hidden rounded-md border border-border bg-black" style={{ aspectRatio: `${plan.width} / ${plan.height}` }}>
      {plan.reshape === "fit" && media("absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-xl")}
      {media(cn("relative h-full w-full", plan.reshape === "fill" ? "object-cover" : "object-contain"))}
    </div>
  );
}

function Tile({ item, plan, platforms, note }: { item: PendingFile; plan: Pick<Plan, "width" | "height" | "reshape">; platforms: Platform[]; note: string }) {
  return (
    <li className="space-y-1.5">
      <Preview item={item} plan={plan} />
      <p className="text-[11px] leading-4 text-muted-foreground">
        <span className="font-semibold text-foreground">{platforms.length ? list(platforms.map(platformLabel)) : "Original"}</span> · {plan.width}×{plan.height} {note}
      </p>
    </li>
  );
}

/** Between picking files and uploading them: shows what each platform will get, and the framing to use where shapes differ. */
export function MediaPrepPanel({
  items,
  platforms,
  framing,
  onFraming,
  onConfirm,
  onCancel,
  progress,
}: {
  items: PendingFile[];
  /** The platforms this post goes to; each gets a copy that fits it. */
  platforms: PlatformInfo[];
  framing: Framing;
  onFraming: (f: Framing) => void;
  onConfirm: () => void;
  onCancel: () => void;
  progress: PrepProgress | null;
}) {
  const busy = progress !== null;
  const showFraming = framingMatters(items.map((i) => i.info), platforms);
  return (
    <Card className="space-y-4 border-primary/40 p-4">
      <div>
        <p className="text-sm font-semibold text-foreground">Ready for each platform</p>
        <p className="text-xs text-muted-foreground">
          {platforms.length > 0
            ? "We make a copy that fits each platform’s size and shape limits, in your browser, before uploading."
            : "Choose the accounts to post to, and we’ll make a copy that fits each platform."}
        </p>
      </div>
      {showFraming && (
        <fieldset disabled={busy} className="space-y-2">
          <legend className="text-xs font-semibold text-foreground">Framing where a platform wants another shape</legend>
          <div className="flex flex-wrap gap-2">
            {FRAMINGS.map((f) => (
              <Chip key={f.value} active={framing === f.value} onClick={() => onFraming(f.value)}>{f.label}</Chip>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{FRAMINGS.find((f) => f.value === framing)?.hint}</p>
        </fieldset>
      )}
      {items.map((item) => {
        const { copies, asIs } = outcomes(item.info, platforms, framing);
        const source = [`${item.info.width}×${item.info.height}`, item.info.fps && `${Math.round(item.info.fps)} fps`, item.info.durationSec && clock(item.info.durationSec)].filter(Boolean).join(" · ");
        return (
          <div key={item.preview} className="space-y-2">
            <p className="truncate text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{item.file.name}</span> · {source}
            </p>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {asIs.length > 0 && <Tile item={item} plan={{ width: item.info.width, height: item.info.height, reshape: "none" }} platforms={asIs} note="· as it is" />}
              {copies.map((c) => (
                <Tile
                  key={c.platforms.join()}
                  item={item}
                  plan={c.plan}
                  platforms={c.platforms}
                  note={`· ${c.plan.reshape === "none" ? "resized" : c.plan.reshape === "fit" ? "fitted" : "cropped"}, ${c.plan.kind === "video" ? "MP4" : "JPEG"}`}
                />
              ))}
              {platforms.length === 0 && <Tile item={item} plan={{ width: item.info.width, height: item.info.height, reshape: "none" }} platforms={[]} note="" />}
            </ul>
          </div>
        );
      })}
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
