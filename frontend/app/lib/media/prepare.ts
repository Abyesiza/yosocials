/**
 * Prepares uploads in the browser so TikTok accepts them as they are:
 * photos as JPEG within 1080p, videos as H.264 MP4 at 360–4096 px and
 * 23–60 fps. Vertical 1080×1920 (9:16) is what TikTok recommends.
 */

export type Framing = "fit" | "fill" | "original";

export const TARGET = { width: 1080, height: 1920 } as const;
const VIDEO_SIDE = { min: 360, max: 4096 };
const FPS = { min: 23, max: 60, fallback: 30 };
const JPEG_QUALITY = 0.9;

export interface MediaInfo {
  kind: "image" | "video";
  width: number;
  height: number;
  durationSec: number | null;
  fps: number | null;
  /** True when the file can go to TikTok without any change. */
  ready: boolean;
}

export interface PreparedFile {
  file: File;
  durationSec: number | null;
}

const isVertical = ({ width, height }: { width: number; height: number }) =>
  Math.abs(width / height - TARGET.width / TARGET.height) < 0.01;

/** Largest size within TikTok's photo limit (1080p in either orientation), never upscaled. */
function photoBox(width: number, height: number) {
  const [maxW, maxH] = width > height ? [1920, 1080] : [1080, 1920];
  const scale = Math.min(1, maxW / width, maxH / height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export async function inspect(file: File): Promise<MediaInfo> {
  if (file.type.startsWith("image/")) {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    bitmap.close();
    const fits = photoBox(width, height).width === width;
    return { kind: "image", width, height, durationSec: null, fps: null, ready: fits && (file.type === "image/jpeg" || file.type === "image/webp") };
  }
  const { Input, BlobSource, ALL_FORMATS } = await import("mediabunny");
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error(`${file.name} has no video in it.`);
    const width = track.displayWidth;
    const height = track.displayHeight;
    const durationSec = await input.computeDuration();
    const fps = (await track.computePacketStats(100)).averagePacketRate || null;
    const codec = await track.getCodec();
    const sideOk = [width, height].every((s) => s >= VIDEO_SIDE.min && s <= VIDEO_SIDE.max);
    const fpsOk = fps === null || (fps >= FPS.min && fps <= FPS.max);
    const ready = file.type === "video/mp4" && (codec === "avc" || codec === "hevc") && sideOk && fpsOk;
    return { kind: "video", width, height, durationSec, fps, ready };
  } finally {
    input.dispose();
  }
}

/** A suggested framing: leave files that already fit TikTok alone. */
export const suggestFraming = (info: MediaInfo): Framing => (info.ready && isVertical(info) ? "original" : "fit");

/** Draws `source` into a vertical canvas: blurred backdrop + whole picture (fit) or cropped (fill). */
function compose(ctx: OffscreenCanvasRenderingContext2D, source: { w: number; h: number; draw: (c: OffscreenCanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void }, framing: "fit" | "fill", backdrop: OffscreenCanvasRenderingContext2D) {
  const { width: W, height: H } = TARGET;
  const cover = Math.max(W / source.w, H / source.h);
  if (framing === "fill") {
    source.draw(ctx, (W - source.w * cover) / 2, (H - source.h * cover) / 2, source.w * cover, source.h * cover);
    return;
  }
  // Drawing tiny and scaling up blurs the backdrop far more cheaply than a CSS blur filter per frame.
  const bw = backdrop.canvas.width;
  const bh = backdrop.canvas.height;
  const small = Math.max(bw / source.w, bh / source.h);
  source.draw(backdrop, (bw - source.w * small) / 2, (bh - source.h * small) / 2, source.w * small, source.h * small);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(backdrop.canvas, 0, 0, W, H);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, 0, W, H);
  const fit = Math.min(W / source.w, H / source.h);
  source.draw(ctx, (W - source.w * fit) / 2, (H - source.h * fit) / 2, source.w * fit, source.h * fit);
}

function canvases() {
  const ctx = new OffscreenCanvas(TARGET.width, TARGET.height).getContext("2d")!;
  const backdrop = new OffscreenCanvas(27, 48).getContext("2d")!;
  return { ctx, backdrop };
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

const renamed = (name: string, ext: string) => `${name.replace(/\.[^.]+$/, "") || "media"}.${ext}`;

export async function prepareImage(file: File, framing: Framing): Promise<PreparedFile> {
  const bitmap = await createImageBitmap(file);
  try {
    let ctx: OffscreenCanvasRenderingContext2D;
    if (framing === "original") {
      const box = photoBox(bitmap.width, bitmap.height);
      ctx = new OffscreenCanvas(box.width, box.height).getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0, box.width, box.height);
    } else {
      const c = canvases();
      ctx = c.ctx;
      compose(ctx, { w: bitmap.width, h: bitmap.height, draw: (target, x, y, w, h) => target.drawImage(bitmap, x, y, w, h) }, framing, c.backdrop);
    }
    const blob = await ctx.canvas.convertToBlob({ type: "image/jpeg", quality: JPEG_QUALITY });
    return { file: new File([blob], renamed(file.name, "jpg"), { type: "image/jpeg" }), durationSec: null };
  } finally {
    bitmap.close();
  }
}

export async function prepareVideo(file: File, info: MediaInfo, framing: Framing, onProgress: (p: number) => void): Promise<PreparedFile> {
  if (framing === "original" && info.ready) return { file, durationSec: info.durationSec };

  const mb = await import("mediabunny");
  if (!(await mb.canEncodeVideo("avc", { width: TARGET.width, height: TARGET.height }))) {
    throw new Error("This browser can’t prepare videos. Use Chrome, Edge or Safari, or upload an MP4 that’s already 1080×1920.");
  }
  await ensureAac(mb);
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
  const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }), target: new mb.BufferTarget() });
  const fpsOk = info.fps !== null && info.fps >= FPS.min && info.fps <= FPS.max;
  const { ctx, backdrop } = canvases();

  // Original framing only scales the video into TikTok's size limits.
  const scale = Math.min(1, VIDEO_SIDE.max / Math.max(info.width, info.height));
  const sizing =
    framing === "original"
      ? { width: Math.max(VIDEO_SIDE.min, Math.round((info.width * scale) / 2) * 2) }
      : framing === "fill"
        ? { width: TARGET.width, height: TARGET.height, fit: "cover" as const }
        : {
            processedWidth: TARGET.width,
            processedHeight: TARGET.height,
            process: (sample: import("mediabunny").VideoSample) => {
              compose(ctx, { w: sample.displayWidth, h: sample.displayHeight, draw: (target, x, y, w, h) => sample.draw(target, x, y, w, h) }, "fit", backdrop);
              return ctx.canvas;
            },
          };

  try {
    const conversion = await mb.Conversion.init({
      input,
      output,
      video: { codec: "avc", quality: mb.QUALITY_HIGH, forceTranscode: true, ...(fpsOk ? {} : { frameRate: FPS.fallback }), ...sizing },
      audio: { codec: "aac" },
    });
    const lostAudio = conversion.discardedTracks.some((d) => d.track.type === "audio" && d.reason === "no_encodable_target_codec");
    if (!conversion.isValid || lostAudio) {
      throw new Error("This browser can’t prepare this video. Try Chrome, Edge or Safari.");
    }
    conversion.onProgress = onProgress;
    await conversion.execute();
    const buffer = output.target.buffer!;
    return { file: new File([buffer], renamed(file.name, "mp4"), { type: "video/mp4" }), durationSec: info.durationSec };
  } finally {
    input.dispose();
  }
}
