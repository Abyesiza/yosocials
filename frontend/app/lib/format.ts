/** Small display helpers shared by the app's views. */

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "3m", "2h", "5d" like Instagram, or a date for older items. */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 0) return timeUntil(iso);
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 7 * 86_400) return `${Math.floor(seconds / 86_400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function timeUntil(iso: string): string {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  if (Math.abs(minutes) < 1440) return rtf.format(Math.round(minutes / 60), "hour");
  return rtf.format(Math.round(minutes / 1440), "day");
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function compact(n: number | null | undefined): string {
  if (n === null || n === undefined) return "–";
  return new Intl.NumberFormat("en", { notation: "compact" }).format(n);
}

/** Value for <input type="datetime-local"> in the user's timezone. */
export function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Counts what the user sees as characters (an emoji is 1). */
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function graphemes(text: string): number {
  return Array.from(segmenter.segment(text)).length;
}

/** Code points X counts as 1; the rest count 2. Mirrors the API's `common/text/text-length.ts`. */
const LIGHT_RANGES: readonly [number, number][] = [
  [0, 4351],
  [8192, 8205],
  [8208, 8223],
  [8242, 8247],
];
const URL_LENGTH = 23;
// Links X turns into t.co: with a scheme, www., or a bare domain on a common TLD.
const URL =
  /(?<![\w@.-])(?:https?:\/\/\S+|www\.[^\s.]+\.\S+|(?:[a-z0-9-]+\.)+(?:com|net|org|io|co|ai|app|dev|me|ly|gg|tv|xyz|info|biz|news|blog|shop|store|site|online|tech|us|uk|ug|ke|tz|rw|ng|za|in|de|fr|es|it|nl|ca|au|edu|gov)(?:\/\S*)?)(?![\w-])/giu;
const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

/** X's weighted length (twitter-text v3): links count 23, emoji and CJK characters 2. */
export function xWeightedLength(text: string): number {
  let length = 0;
  const rest = text.normalize("NFC").replace(URL, () => {
    length += URL_LENGTH;
    return "";
  });
  for (const { segment } of segmenter.segment(rest)) {
    if (EMOJI.test(segment)) {
      length += 2;
      continue;
    }
    for (const char of segment) {
      const code = char.codePointAt(0)!;
      length += LIGHT_RANGES.some(([a, b]) => code >= a && code <= b) ? 1 : 2;
    }
  }
  return length;
}

/** Video length like 0:42 or 12:05. */
export function clock(seconds: number): string {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
