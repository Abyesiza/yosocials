import type { AspectSpec, ImageSpec, MediaCapabilities, Platform, VideoSpec } from "@/app/lib/api/types";

/**
 * How media is reshaped when a platform wants a different shape: `fit` keeps
 * the whole picture on a blurred backdrop, `fill` crops to fill the frame,
 * `original` keeps the shape wherever the platform allows it.
 */
export type Framing = "fit" | "fill" | "original";

/** What the browser measured about a file (or, for media already uploaded, what we know). */
export interface SourceInfo {
  kind: "image" | "video";
  contentType: string;
  size: number;
  width: number;
  height: number;
  durationSec: number | null;
  /** null when unknown (media uploaded earlier): assumed fine. */
  fps: number | null;
  /** mediabunny codec name (avc, hevc, vp9…); null when unknown. */
  codec: string | null;
}

/** A copy to make: exact pixel size, how to reshape, and the size budget. */
export interface Plan {
  kind: "image" | "video";
  width: number;
  height: number;
  reshape: "none" | "fit" | "fill";
  contentType: "image/jpeg" | "video/mp4";
  maxBytes: number;
  /** Video frame rate to convert to; null keeps the source's. */
  fps: number | null;
}

/** One copy and the platforms it serves (identical needs share one file). */
export interface PlannedCopy {
  plan: Plan;
  platforms: Platform[];
}

const SAME_SHAPE = 0.01;
const FALLBACK_FPS = 30;

const ratioOf = (w: number, h: number) => w / h;

/** The shape to make: the platform's preferred one (unless kept original), else the source's, within its limits. */
function targetRatio(source: number, aspect: AspectSpec | undefined, framing: Framing): number {
  if (aspect?.preferred && framing !== "original") return aspect.preferred;
  return Math.min(aspect?.max ?? Infinity, Math.max(aspect?.min ?? 0, source));
}

/** The canvas at `ratio` that holds the source without upscaling: around it (fit) or inside it (fill). */
function canvasFor(w: number, h: number, ratio: number, reshape: Plan["reshape"]) {
  if (reshape === "none") return { width: w, height: h };
  const narrower = ratio < ratioOf(w, h);
  const around = reshape === "fit";
  if (narrower === around) return { width: w, height: w / ratio };
  return { width: h * ratio, height: h };
}

function scaleToFit(width: number, height: number, spec: ImageSpec | VideoSpec): number {
  const long = Math.max(width, height);
  const short = Math.min(width, height);
  let scale = Math.min(1, spec.maxLongSide / long, spec.maxShortSide / short);
  if (spec.maxPixels) scale = Math.min(scale, Math.sqrt(spec.maxPixels / (width * height)));
  if ("maxSideSum" in spec && spec.maxSideSum) scale = Math.min(scale, spec.maxSideSum / (width + height));
  // The only upscale: up to a platform's smallest allowed size.
  const minShort = "minShortSide" in spec ? spec.minShortSide : undefined;
  if (minShort && short * scale < minShort) scale = minShort / short;
  return scale;
}

/** The copy `spec` needs, or null when the original already fits as it is. */
export function planFor(src: SourceInfo, spec: ImageSpec | VideoSpec, framing: Framing): Plan | null {
  const sourceRatio = ratioOf(src.width, src.height);
  const ratio = targetRatio(sourceRatio, spec.aspect, framing);
  const reshape: Plan["reshape"] = Math.abs(ratio - sourceRatio) / sourceRatio < SAME_SHAPE ? "none" : framing === "fill" ? "fill" : "fit";
  const canvas = canvasFor(src.width, src.height, ratio, reshape);
  const scale = scaleToFit(canvas.width, canvas.height, spec);
  const video = src.kind === "video";
  // Video encoders need even sizes.
  const round = (n: number) => (video ? Math.max(2, Math.round(n / 2) * 2) : Math.max(1, Math.round(n)));
  const width = round(canvas.width * scale);
  const height = round(canvas.height * scale);

  const videoSpec = video ? (spec as VideoSpec) : null;
  const fpsOut =
    videoSpec && src.fps !== null && ((videoSpec.minFps && src.fps < videoSpec.minFps) || (videoSpec.maxFps && src.fps > videoSpec.maxFps))
      ? Math.min(videoSpec.maxFps ?? FALLBACK_FPS, Math.max(videoSpec.minFps ?? 0, FALLBACK_FPS))
      : null;
  const codecOk = !videoSpec || src.codec === null || videoSpec.codecs.includes(src.codec);
  const unchanged = reshape === "none" && width === round(src.width) && height === round(src.height);
  if (unchanged && spec.types.includes(src.contentType) && src.size <= spec.maxBytes && codecOk && fpsOut === null) return null;

  return {
    kind: src.kind,
    width,
    height,
    reshape,
    contentType: video ? "video/mp4" : "image/jpeg",
    maxBytes: spec.maxBytes,
    fps: fpsOut,
  };
}

const specOf = (caps: MediaCapabilities, kind: SourceInfo["kind"]) => (kind === "video" ? caps.videoSpec : caps.imageSpec);

/**
 * The copies one file needs for these platforms. Platforms whose copy would
 * be the same size and shape share one, made within the smallest size budget.
 */
export function copiesFor(src: SourceInfo, platforms: { platform: Platform; media: MediaCapabilities | null }[], framing: Framing): PlannedCopy[] {
  const copies = new Map<string, PlannedCopy>();
  for (const { platform, media } of platforms) {
    const spec = media && specOf(media, src.kind);
    if (!spec) continue;
    const plan = planFor(src, spec, framing);
    if (!plan) continue;
    const key = `${plan.width}x${plan.height}:${plan.reshape}:${plan.fps ?? "src"}`;
    const shared = copies.get(key);
    if (shared) {
      shared.plan.maxBytes = Math.min(shared.plan.maxBytes, plan.maxBytes);
      shared.platforms.push(platform);
    } else {
      copies.set(key, { plan, platforms: [platform] });
    }
  }
  return [...copies.values()];
}

/** True when some platform here prefers a shape this media doesn't have, so the framing choice matters. */
export function framingMatters(sources: SourceInfo[], platforms: { media: MediaCapabilities | null }[]): boolean {
  return sources.some((src) =>
    platforms.some(({ media }) => {
      const aspect = media && specOf(media, src.kind)?.aspect;
      if (!aspect) return false;
      const r = ratioOf(src.width, src.height);
      return (aspect.preferred !== undefined && Math.abs(aspect.preferred - r) / r >= SAME_SHAPE) || (aspect.min !== undefined && r < aspect.min) || (aspect.max !== undefined && r > aspect.max);
    }),
  );
}
