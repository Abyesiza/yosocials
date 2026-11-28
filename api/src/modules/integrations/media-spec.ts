import type {
  AspectSpec,
  ImageSpec,
  MediaCapabilities,
  PublishMedia,
  VideoSpec,
} from './interfaces/platform-provider.interface.js';

const MB = 1024 * 1024;
/** Rounding slack, so an encoder's 1079.6 → 1080 doesn't fail a 1080 limit. */
const ASPECT_SLACK = 0.01;

const REPREPARE =
  'Open the post and remove the media, then add it again so Aby Socials prepares a copy that fits.';

/**
 * Problems with a post's media for one platform, phrased to follow
 * “To post to @handle on X, …”. Empty when everything fits. Dimensions are
 * only checked when known (media attached before they were recorded skips them).
 */
export function mediaIssues(
  media: PublishMedia[],
  caps: MediaCapabilities | undefined,
): string[] {
  if (!caps || media.length === 0) return [];
  const issues: string[] = [];
  const images = media.filter((m) => m.kind === 'image');
  const video = media.find((m) => m.kind === 'video');

  if (images.length > 0 && caps.maxImages === 0) {
    issues.push('remove the photos. This platform doesn’t take photos.');
  } else if (images.length > caps.maxImages) {
    issues.push(`add up to ${caps.maxImages} photos.`);
  }
  if (video && !caps.video)
    issues.push('remove the video. This platform doesn’t take videos.');

  const imageSpec = caps.imageSpec;
  if (imageSpec) {
    for (const image of images) {
      const problem = imageProblem(image, imageSpec);
      if (problem) {
        issues.push(`${problem} ${REPREPARE}`);
        break;
      }
    }
  }
  if (video && caps.videoSpec) {
    const problem = videoProblem(video, caps.videoSpec);
    if (problem) issues.push(problem);
  }
  return issues;
}

function imageProblem(m: PublishMedia, spec: ImageSpec): string | null {
  if (!spec.types.includes(m.contentType)) {
    return `use ${formats(spec.types)} photos.`;
  }
  if (m.size > spec.maxBytes) return `use photos up to ${size(spec.maxBytes)}.`;
  if (!m.width || !m.height) return null;
  if (tooBig(m.width, m.height, spec)) {
    return `use photos up to ${spec.maxLongSide}×${spec.maxShortSide} pixels.`;
  }
  if (spec.maxPixels && m.width * m.height > spec.maxPixels) {
    return 'use smaller photos.';
  }
  if (spec.maxSideSum && m.width + m.height > spec.maxSideSum) {
    return 'use smaller photos.';
  }
  return aspectProblem(m, spec.aspect, 'photos');
}

function videoProblem(m: PublishMedia, spec: VideoSpec): string | null {
  const duration = m.durationSec;
  // Length can't be fixed by re-encoding, so it gets its own advice.
  if (duration && spec.maxDurationSec && duration > spec.maxDurationSec + 0.5) {
    return `use a video up to ${clock(spec.maxDurationSec)} long. This one is ${clock(duration)}.`;
  }
  if (duration && spec.minDurationSec && duration < spec.minDurationSec) {
    return `use a video at least ${spec.minDurationSec} seconds long.`;
  }
  let problem: string | null = null;
  if (!spec.types.includes(m.contentType))
    problem = `use ${formats(spec.types)} video.`;
  else if (m.size > spec.maxBytes)
    problem = `use a video up to ${size(spec.maxBytes)}.`;
  else if (m.width && m.height) {
    const short = Math.min(m.width, m.height);
    if (tooBig(m.width, m.height, spec)) {
      problem = `use a video up to ${spec.maxLongSide}×${spec.maxShortSide} pixels.`;
    } else if (spec.maxPixels && m.width * m.height > spec.maxPixels) {
      problem = 'use a smaller video.';
    } else if (spec.minShortSide && short < spec.minShortSide) {
      problem = `use a video at least ${spec.minShortSide} pixels on its shortest side.`;
    } else {
      problem = aspectProblem(m, spec.aspect, 'video');
    }
  }
  return problem && `${problem} ${REPREPARE}`;
}

function tooBig(
  width: number,
  height: number,
  spec: { maxLongSide: number; maxShortSide: number },
): boolean {
  return (
    Math.max(width, height) > spec.maxLongSide ||
    Math.min(width, height) > spec.maxShortSide
  );
}

function aspectProblem(
  m: PublishMedia,
  aspect: AspectSpec | undefined,
  noun: string,
): string | null {
  if (!aspect || !m.width || !m.height) return null;
  const ratio = m.width / m.height;
  if (aspect.min !== undefined && ratio < aspect.min - ASPECT_SLACK) {
    return `use ${noun} that are less tall: the narrowest shape allowed is ${shape(aspect.min)}.`;
  }
  if (aspect.max !== undefined && ratio > aspect.max + ASPECT_SLACK) {
    return `use ${noun} that are less wide: the widest shape allowed is ${shape(aspect.max)}.`;
  }
  return null;
}

const NAMES: Record<string, string> = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/gif': 'GIF',
  'image/webp': 'WebP',
  'video/mp4': 'MP4',
  'video/quicktime': 'MOV',
  'video/webm': 'WebM',
};

function formats(types: string[]): string {
  const names = types.map((t) => NAMES[t] ?? t);
  return names.length > 1
    ? `${names.slice(0, -1).join(', ')} or ${names.at(-1)}`
    : names[0];
}

function size(bytes: number): string {
  // Limits are set in MiB (16 * 1024 * 1024) or in round decimal bytes (20_000_000); say each as written.
  if (bytes % MB === 0) return `${bytes / MB} MB`;
  return bytes >= 1_000_000
    ? `${Math.round(bytes / 1_000_000)} MB`
    : `${Math.round(bytes / 1000)} KB`;
}

function clock(sec: number): string {
  const s = Math.round(sec);
  return s >= 60
    ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
    : `${s} seconds`;
}

/** 0.5625 → “9:16”, 1.91 → “1.91:1”. */
function shape(ratio: number): string {
  const known: [number, string][] = [
    [9 / 16, '9:16'],
    [4 / 5, '4:5'],
    [1, '1:1'],
    [16 / 9, '16:9'],
    [1 / 2.4, '1:2.4'],
    [2.4, '2.4:1'],
    [1 / 3, '1:3'],
    [3, '3:1'],
  ];
  const match = known.find(([r]) => Math.abs(r - ratio) < 0.005);
  if (match) return match[1];
  return ratio >= 1 ? `${ratio.toFixed(2)}:1` : `1:${(1 / ratio).toFixed(2)}`;
}
