/** Characters the Posts API's "little" text format reserves; plain text must escape them. */
const RESERVED = /[|{}@[\]()<>#\\*_~]/g;

/**
 * Turns plain post text into `little` commentary: every reserved character is
 * backslash-escaped, except a `#` that starts a hashtag, so hashtags still
 * link. Mentions aren't supported, so `@` is always literal.
 */
export function toLittleText(text: string): string {
  return text.replace(RESERVED, (char, offset: number) => {
    const next = text[offset + 1] ?? '';
    const prev = offset > 0 ? text[offset - 1] : '';
    const startsHashtag =
      char === '#' &&
      /[\p{L}\p{N}]/u.test(next) &&
      !/[\p{L}\p{N}_]/u.test(prev);
    return startsHashtag ? char : `\\${char}`;
  });
}
