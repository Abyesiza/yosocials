/**
 * Measures and converts media in the browser. Every platform gets a copy
 * that fits its own limits (see `plan.ts`); this file makes those copies:
 * photos as JPEG, videos as H.264/AAC MP4.
 */
import type { Plan, SourceInfo } from "./plan";

const JPEG_QUALITIES = [0.9, 0.82, 0.74, 0.66];
const SHRINK = 0.85;
const AUDIO_BITRATE = 128_000;
/** Above this a size budget doesn't bind, so use mediabunny's high-quality setting. */
const HIGH_QUALITY_BITRATE = 8_000_000;
/** Leave room for the container and bitrate overshoot. */
const BUDGET_SHARE = 0.9;
/** Uploads we keep as they are; anything else becomes JPEG first. */
const UPLOADABLE_IMAGES = ["image/jpeg", "image/webp"];

export async function inspect(file: Blob, contentType = file.type): Promise<SourceInfo> {
  if (contentType.startsWith("image/")) {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    bitmap.close();
    return { kind: "image", contentType, size: file.size, width, height, durationSec: null, fps: null, codec: null };
  }
  const { Input, BlobSource, ALL_FORMATS } = await import("mediabunny");
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error(`We couldn’t find a video in ${file instanceof File ? file.name : "that file"}. Choose another file.`);
    return {
      kind: "video",
      contentType,
      size: file.size,
      width: track.displayWidth,
      height: track.displayHeight,
      durationSec: await input.computeDuration(),
      fps: (await track.computePacketStats(100)).averagePacketRate || null,
      codec: (await track.getCodec()) ?? null,
    };
  } finally {
    input.dispose();
  }
}

const renamed = (name: string, ext: string) => `${name.replace(/\.[^.]+$/, "") || "media"}.${ext}`;

/** The file we upload as the original: as chosen, except PNG and other photo formats become JPEG at full size. */
export async function toOriginal(file: File, info: SourceInfo): Promise<{ file: File; info: SourceInfo }> {
  if (info.kind === "video" || UPLOADABLE_IMAGES.includes(file.type)) return { file, info };
  const blob = await encodeImage(file, { ...info, contentType: "image/jpeg" }, { kind: "image", width: info.width, height: info.height, reshape: "none", contentType: "image/jpeg", maxBytes: Infinity, fps: null });
  const jpeg = new File([blob], renamed(file.name, "jpg"), { type: "image/jpeg" });
  return { file: jpeg, info: { ...info, contentType: "image/jpeg", size: jpeg.size } };
}

/** Makes the copy `plan` describes from `source`. */
export async function render(source: Blob, info: SourceInfo, plan: Plan, onProgress: (p: number) => void): Promise<File> {
  const name = source instanceof File ? source.name : "media";
  if (plan.kind === "image") {
    const blob = await encodeImage(source, info, plan);
    onProgress(1);
    return new File([blob], renamed(name, "jpg"), { type: "image/jpeg" });
  }
  const data = await encodeVideo(source, info, plan, onProgress);
  return new File([data], renamed(name, "mp4"), { type: "video/mp4" });
}

type Drawable = { w: number; h: number; draw: (c: OffscreenCanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void };

/** Draws `source` into a W×H canvas: scaled (none), cropped to fill (fill), or whole on a blurred backdrop (fit). */
function compose(ctx: OffscreenCanvasRenderingContext2D, source: Drawable, reshape: Plan["reshape"], backdrop: OffscreenCanvasRenderingContext2D) {
  const { width: W, height: H } = ctx.canvas;
  ctx.imageSmoothingQuality = "high";
  if (reshape !== "fit") {
    const s = reshape === "fill" ? Math.max(W / source.w, H / source.h) : Math.min(W / source.w, H / source.h);
    source.draw(ctx, (W - source.w * s) / 2, (H - source.h * s) / 2, source.w * s, source.h * s);
    return;
  }
  // Drawing tiny and scaling up blurs the backdrop far more cheaply than a blur filter per frame.
  const bw = backdrop.canvas.width;
  const bh = backdrop.canvas.height;
  const small = Math.max(bw / source.w, bh / source.h);
  source.draw(backdrop, (bw - source.w * small) / 2, (bh - source.h * small) / 2, source.w * small, source.h * small);
  ctx.drawImage(backdrop.canvas, 0, 0, W, H);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, 0, W, H);
  const fit = Math.min(W / source.w, H / source.h);
  source.draw(ctx, (W - source.w * fit) / 2, (H - source.h * fit) / 2, source.w * fit, source.h * fit);
}

function canvases(width: number, height: number) {
  const ctx = new OffscreenCanvas(width, height).getContext("2d")!;
  const tiny = 48 / Math.max(width, height);
  const backdrop = new OffscreenCanvas(Math.max(1, Math.round(width * tiny)), Math.max(1, Math.round(height * tiny))).getContext("2d")!;
  return { ctx, backdrop };
}

/** JPEG within the plan's byte budget: lower quality first, then smaller, never below a quarter size. */
async function encodeImage(source: Blob, info: SourceInfo, plan: Plan): Promise<Blob> {
  const bitmap = await createImageBitmap(source);
  try {
    let { width, height } = plan;
    for (let attempt = 0; attempt < 8; attempt++) {
      const { ctx, backdrop } = canvases(width, height);
      compose(ctx, { w: bitmap.width, h: bitmap.height, draw: (c, x, y, w, h) => c.drawImage(bitmap, x, y, w, h) }, plan.reshape, backdrop);
      for (const quality of JPEG_QUALITIES) {
        const blob = await ctx.canvas.convertToBlob({ type: "image/jpeg", quality });
        if (blob.size <= plan.maxBytes) return blob;
      }
      if (width < plan.width / 4) break;
      width = Math.round(width * SHRINK);
      height = Math.round(height * SHRINK);
    }
    throw new Error(`We couldn’t make this photo small enough (${Math.round(info.size / 1024)} KB). Try a smaller photo.`);
  } finally {
    bitmap.close();
  }
}

let aacReady: Promise<void> | undefined;
/** Some browsers (Firefox, Chrome on Linux) can't encode AAC natively; load a WASM encoder only then. */
function ensureAac(mb: typeof import("mediabunny")): Promise<void> {
  aacReady ??= mb.canEncodeAudio("aac").then(async (native) => {
    if (native) return;
    const { registerAacEncoder } = await import("@mediabunny/aac-encoder");
    registerAacEncoder();
  });
  return aacReady;
}

/** The video bitrate that keeps the file inside its budget, or null when the budget doesn't bind. */
function budgetBitrate(plan: Plan, durationSec: number | null, factor: number): number | null {
  if (!durationSec || !Number.isFinite(plan.maxBytes)) return null;
  const total = (plan.maxBytes * 8 * BUDGET_SHARE * factor) / durationSec;
  const video = total - AUDIO_BITRATE;
  if (video >= HIGH_QUALITY_BITRATE) return null;
  if (video < 150_000) throw new Error("This video is too long to fit the platform’s file size limit. Use a shorter video.");
  return Math.round(video);
}

/** Smaller frames look better than starved bitrates. */
function sizeForBitrate(plan: Plan, bitrate: number | null): { width: number; height: number } {
  if (bitrate === null) return plan;
  const cap = bitrate < 1_000_000 ? 854 : bitrate < 2_500_000 ? 1280 : Infinity;
  const long = Math.max(plan.width, plan.height);
  if (long <= cap) return plan;
  const s = cap / long;
  const even = (n: number) => Math.max(2, Math.round((n * s) / 2) * 2);
  return { width: even(plan.width), height: even(plan.height) };
}

async function encodeVideo(source: Blob, info: SourceInfo, plan: Plan, onProgress: (p: number) => void): Promise<ArrayBuffer> {
  const mb = await import("mediabunny");
  if (!(await mb.canEncodeVideo("avc", { width: plan.width, height: plan.height }))) {
    throw new Error("This browser can’t prepare videos. Use Chrome, Edge or Safari.");
  }
  await ensureAac(mb);
  // A first pass may overshoot a tight budget; retry with a lower target.
  for (const factor of [1, 0.8, 0.65]) {
    const bitrate = budgetBitrate(plan, info.durationSec, factor);
    const { width, height } = sizeForBitrate(plan, bitrate);
    const input = new mb.Input({ source: new mb.BlobSource(source), formats: mb.ALL_FORMATS });
    const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }), target: new mb.BufferTarget() });
    const { ctx, backdrop } = canvases(width, height);
    const sizing =
      plan.reshape === "fit"
        ? {
            processedWidth: width,
            processedHeight: height,
            process: (sample: import("mediabunny").VideoSample) => {
              compose(ctx, { w: sample.displayWidth, h: sample.displayHeight, draw: (c, x, y, w, h) => sample.draw(c, x, y, w, h) }, "fit", backdrop);
              return ctx.canvas;
            },
          }
        : { width, height, fit: plan.reshape === "fill" ? ("cover" as const) : ("contain" as const) };
    try {
      const conversion = await mb.Conversion.init({
        input,
        output,
        video: { codec: "avc", bitrate: bitrate ?? mb.QUALITY_HIGH, forceTranscode: true, ...(plan.fps ? { frameRate: plan.fps } : {}), ...sizing },
        audio: { codec: "aac", bitrate: AUDIO_BITRATE },
      });
      const lostAudio = conversion.discardedTracks.some((d) => d.track.type === "audio" && d.reason === "no_encodable_target_codec");
      if (!conversion.isValid || lostAudio) throw new Error("This browser can’t prepare this video. Try Chrome, Edge or Safari.");
      conversion.onProgress = onProgress;
      await conversion.execute();
      const buffer = output.target.buffer!;
      if (buffer.byteLength <= plan.maxBytes) return buffer;
    } finally {
      input.dispose();
    }
  }
  throw new Error("We couldn’t make this video small enough for every platform. Use a shorter video.");
}
