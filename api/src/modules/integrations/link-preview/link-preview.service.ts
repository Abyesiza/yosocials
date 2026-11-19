import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { safeFetch } from './safe-fetch.js';

export interface LinkPreview {
  url: string;
  title: string;
  description: string;
  image?: { data: Uint8Array; mimeType: 'image/jpeg' };
}

const HTML_LIMIT = 512 * 1024;
const IMAGE_LIMIT = 5 * 1024 * 1024;
// Bluesky rejects blobs over 1,000,000 bytes for card thumbnails.
const THUMB_LIMIT = 950_000;

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decode(text: string): string {
  return text
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === '#')
        return String.fromCodePoint(
          parseInt(
            e.slice(e[1] === 'x' || e[1] === 'X' ? 2 : 1),
            e[1] === 'x' || e[1] === 'X' ? 16 : 10,
          ),
        );
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/** Reads `<meta property|name="key" content="…">` in either attribute order. */
function meta(html: string, key: string): string | undefined {
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${k}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${k}["']`,
    'i',
  );
  const m = re.exec(html);
  const value = m?.[1] ?? m?.[2];
  return value ? decode(value) : undefined;
}

export function parsePreview(
  html: string,
  pageUrl: URL,
): Omit<LinkPreview, 'image'> & { imageUrl?: string } {
  const title =
    meta(html, 'og:title') ??
    meta(html, 'twitter:title') ??
    decode(/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? '') ??
    '';
  const description =
    meta(html, 'og:description') ??
    meta(html, 'twitter:description') ??
    meta(html, 'description') ??
    '';
  const image = meta(html, 'og:image') ?? meta(html, 'twitter:image');
  let imageUrl: string | undefined;
  try {
    imageUrl = image ? new URL(image, pageUrl).toString() : undefined;
  } catch {
    imageUrl = undefined;
  }
  return {
    url: pageUrl.toString(),
    title: title || pageUrl.hostname,
    description,
    imageUrl,
  };
}

/** JPEG under the blob limit; re-encoding drops EXIF/GPS metadata, as Bluesky asks. */
export async function encodeThumbnail(
  input: Uint8Array,
): Promise<LinkPreview['image']> {
  for (const quality of [80, 65, 50]) {
    const data = await sharp(input, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    if (data.byteLength <= THUMB_LIMIT) return { data, mimeType: 'image/jpeg' };
  }
  return undefined;
}

/** Builds a website card (title, description, thumbnail) for a link, or null. */
@Injectable()
export class LinkPreviewService {
  private readonly logger = new Logger(LinkPreviewService.name);

  async fetch(url: string): Promise<LinkPreview | null> {
    try {
      const page = await safeFetch(url, { maxBytes: HTML_LIMIT });
      if (!/text\/html|application\/xhtml/i.test(page.contentType)) return null;
      const { imageUrl, ...preview } = parsePreview(
        Buffer.from(page.body).toString('utf8'),
        page.url,
      );
      const image = imageUrl ? await this.thumbnail(imageUrl) : undefined;
      return { ...preview, url, ...(image && { image }) };
    } catch (error) {
      this.logger.debug(
        `No preview for ${url}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private async thumbnail(imageUrl: string): Promise<LinkPreview['image']> {
    try {
      const { body } = await safeFetch(imageUrl, { maxBytes: IMAGE_LIMIT });
      return await encodeThumbnail(body);
    } catch (error) {
      this.logger.debug(
        `Thumbnail skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
      return undefined;
    }
  }
}
