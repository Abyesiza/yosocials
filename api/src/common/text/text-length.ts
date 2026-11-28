/**
 * How a platform counts the length of a post: Unicode graphemes, UTF-16
 * characters, or X's weighted count. Mirrored in the web app's
 * `app/lib/format.ts`; keep the two in step.
 */
export type LengthUnit = 'graphemes' | 'characters' | 'weighted';

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** Counts user-perceived characters (e.g. one emoji = 1). */
export function countGraphemes(text: string): number {
  let count = 0;
  for (const _ of segmenter.segment(text)) count++;
  return count;
}

/** Code points X counts as 1 (Latin, most scripts, common punctuation); the rest count 2. */
const LIGHT_RANGES: readonly [number, number][] = [
  [0, 4351],
  [8192, 8205],
  [8208, 8223],
  [8242, 8247],
];
/** Every link is shortened to t.co, so it counts as this many. */
const URL_LENGTH = 23;
// Links X turns into t.co: with a scheme, www., or a bare domain on a common TLD.
const URL =
  /(?<![\w@.-])(?:https?:\/\/\S+|www\.[^\s.]+\.\S+|(?:[a-z0-9-]+\.)+(?:com|net|org|io|co|ai|app|dev|me|ly|gg|tv|xyz|info|biz|news|blog|shop|store|site|online|tech|us|uk|ug|ke|tz|rw|ng|za|in|de|fr|es|it|nl|ca|au|edu|gov)(?:\/\S*)?)(?![\w-])/giu;
const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

/** X's weighted length (twitter-text v3): what its 280 limit is measured in. */
export function xWeightedLength(text: string): number {
  let length = 0;
  const rest = text.normalize('NFC').replace(URL, () => {
    length += URL_LENGTH;
    return '';
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

export function textLength(text: string, unit: LengthUnit): number {
  if (unit === 'graphemes') return countGraphemes(text);
  if (unit === 'weighted') return xWeightedLength(text);
  return text.length;
}
