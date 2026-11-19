import sharp from 'sharp';
import { encodeThumbnail, parsePreview } from './link-preview.service.js';
import { isPublicAddress, safeFetch, UnsafeUrlError } from './safe-fetch.js';

describe('isPublicAddress', () => {
  it.each([
    ['8.8.8.8', true],
    ['1.1.1.1', true],
    ['2606:4700:4700::1111', true],
    ['127.0.0.1', false],
    ['10.1.2.3', false],
    ['172.20.0.5', false],
    ['192.168.1.1', false],
    ['169.254.169.254', false],
    ['100.64.0.1', false],
    ['0.0.0.0', false],
    ['::1', false],
    ['fd00::1', false],
    ['fe80::1', false],
    ['::ffff:127.0.0.1', false],
    ['::ffff:8.8.8.8', true],
    ['not-an-ip', false],
  ])('%s → %s', (ip, expected) => {
    expect(isPublicAddress(ip)).toBe(expected);
  });
});

describe('safeFetch', () => {
  it.each([
    'http://127.0.0.1/',
    'http://[::1]/',
    'http://169.254.169.254/latest/meta-data/',
    'file:///etc/passwd',
    'https://example.com:8443/',
    'https://user:pass@example.com/',
  ])('refuses %s before connecting', async (url) => {
    await expect(safeFetch(url, { maxBytes: 1000 })).rejects.toBeInstanceOf(
      UnsafeUrlError,
    );
  });

  it('refuses hostnames that resolve to private addresses', async () => {
    await expect(
      safeFetch('http://localhost/', { maxBytes: 1000 }),
    ).rejects.toThrow(/non-public host|fetch failed/i);
  });
});

describe('parsePreview', () => {
  const page = new URL('https://shop.example.com/autumn');

  it('reads Open Graph tags in either attribute order and resolves relative images', () => {
    const html = `<html><head><title>Fallback</title>
      <meta content="Autumn menu &amp; more" property="og:title">
      <meta property="og:description" content="Maple oat latte &#8212; spiced pear">
      <meta property="og:image" content="/img/card.jpg"></head></html>`;
    expect(parsePreview(html, page)).toEqual({
      url: 'https://shop.example.com/autumn',
      title: 'Autumn menu & more',
      description: 'Maple oat latte — spiced pear',
      imageUrl: 'https://shop.example.com/img/card.jpg',
    });
  });

  it('falls back to <title> and the description meta', () => {
    const html =
      '<title> Northwind  Coffee </title><meta name="description" content="Local roasters">';
    expect(parsePreview(html, page)).toMatchObject({
      title: 'Northwind Coffee',
      description: 'Local roasters',
      imageUrl: undefined,
    });
  });
});

describe('encodeThumbnail', () => {
  it('re-encodes to JPEG without EXIF metadata and within the size limit', async () => {
    const withExif = await sharp({
      create: { width: 2400, height: 1600, channels: 3, background: '#1777f2' },
    })
      .withMetadata({
        exif: { IFD0: { Copyright: 'secret', Artist: 'someone' } },
      })
      .jpeg()
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();

    const thumb = await encodeThumbnail(withExif);

    const meta = await sharp(thumb!.data).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.exif).toBeUndefined();
    expect(Math.max(meta.width!, meta.height!)).toBe(1200);
    expect(thumb!.data.byteLength).toBeLessThanOrEqual(950_000);
  });
});
