const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

/** Decodes XML character references in one pass, so `&amp;lt;` stays `&lt;`. */
export function decodeEntities(text: string): string {
  return text.replace(
    /&(?:#x([0-9a-f]{1,6})|#(\d{1,7})|([a-z]+));/gi,
    (
      match,
      hex: string | undefined,
      dec: string | undefined,
      name?: string,
    ) => {
      if (name) return NAMED_ENTITIES[name.toLowerCase()] ?? match;
      const code = hex ? parseInt(hex, 16) : Number(dec);
      const valid =
        code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff);
      return valid ? String.fromCodePoint(code) : '';
    },
  );
}

/** Untrusted text from a feed or API as a short, single-line plain string: no tags, no control characters. */
export function plainText(raw: string, maxLength = 300): string {
  return (
    raw
      .replace(/<\/?[a-z][^>]*>/gi, '')
      // Control characters and bidi overrides, which can disguise text.
      .replace(/[\p{Cc}\u202a-\u202e\u2066-\u2069]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLength)
  );
}

/** An absolute http(s) URL, or null for anything else (javascript:, data:, relative). */
export function safeUrl(raw: string | undefined, base?: string): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim(), base);
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
