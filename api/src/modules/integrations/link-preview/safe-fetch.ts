import { lookup, type LookupAddress } from 'node:dns';
import { BlockList, isIP } from 'node:net';
import { Agent, fetch } from 'undici';

// Fetching user-supplied URLs server-side is an SSRF risk: only public hosts are allowed.
const PRIVATE = new BlockList();
for (const [net, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const)
  PRIVATE.addSubnet(net, prefix, 'ipv4');
for (const [net, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  PRIVATE.addSubnet(net, prefix, 'ipv6');
}

export function isPublicAddress(address: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
  if (mapped) return !PRIVATE.check(mapped, 'ipv4');
  const family = isIP(address);
  if (family === 0) return false;
  return !PRIVATE.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

// Checked inside the connection's own lookup, so DNS rebinding can't swap in a private IP later.
function guardedLookup(
  hostname: string,
  options: { all?: boolean; family?: number },
  callback: LookupCallback,
) {
  lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, []);
    const blocked = addresses.find((a) => !isPublicAddress(a.address));
    if (blocked || addresses.length === 0) {
      return callback(
        Object.assign(
          new Error(`Refusing to connect to non-public host ${hostname}`),
          { code: 'EBLOCKED' },
        ),
        [],
      );
    }
    if (options.all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
}

const dispatcher = new Agent({
  connect: { lookup: guardedLookup as never, timeout: 5_000 },
});

export class UnsafeUrlError extends Error {}

function assertFetchable(url: URL): void {
  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    throw new UnsafeUrlError('Only http(s) URLs');
  if (url.port && url.port !== '80' && url.port !== '443')
    throw new UnsafeUrlError('Only default ports');
  if (url.username || url.password)
    throw new UnsafeUrlError('No credentials in URLs');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) && !isPublicAddress(host))
    throw new UnsafeUrlError('Non-public address');
}

export interface SafeFetchResult {
  url: URL;
  contentType: string;
  body: Uint8Array;
}

/** GETs a public URL with a timeout, a body size cap and re-validated redirects. */
export async function safeFetch(
  input: string,
  {
    maxBytes,
    timeoutMs = 6_000,
    maxRedirects = 3,
  }: { maxBytes: number; timeoutMs?: number; maxRedirects?: number },
): Promise<SafeFetchResult> {
  let url = new URL(input);
  const signal = AbortSignal.timeout(timeoutMs);
  for (let hop = 0; ; hop++) {
    assertFetchable(url);
    const res = await fetch(url, {
      dispatcher,
      redirect: 'manual',
      signal,
      headers: {
        'user-agent': 'AbySocialsBot/1.0 (+link previews)',
        accept: 'text/html,image/*;q=0.9,*/*;q=0.5',
      },
    });
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel();
      if (hop >= maxRedirects) throw new UnsafeUrlError('Too many redirects');
      url = new URL(location, url);
      continue;
    }
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    return {
      url,
      contentType: res.headers.get('content-type') ?? '',
      body: await readCapped(res.body as AsyncIterable<Uint8Array>, maxBytes),
    };
  }
}

// Breaking out of the loop cancels the stream, so oversized bodies stop downloading.
async function readCapped(
  body: AsyncIterable<Uint8Array>,
  maxBytes: number,
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of body) {
    size += chunk.byteLength;
    if (size > maxBytes)
      throw new Error(`Response larger than ${maxBytes} bytes`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
