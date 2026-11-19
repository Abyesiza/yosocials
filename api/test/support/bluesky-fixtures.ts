const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');

/** A structurally valid (unsigned) JWT, which the SDK decodes for expiry. */
export function fakeJwt(scope: string, sub = 'did:plc:yosocials0001'): string {
  const now = Math.floor(Date.now() / 1000);
  return `${b64({ alg: 'ES256K', typ: 'at+jwt' })}.${b64({ scope, sub, iat: now, exp: now + 7200 })}.c2ln`;
}

export const DID = 'did:plc:yosocials0001';
export const HANDLE = 'yo.bsky.social';
export const CID =
  'bafyreibjifzpqj6o6wcq3hejh7y4z4z2vmiklkvykc57tw3pcbx3kxifpm';
export const BLOB_CID =
  'bafkreiash5eihfku2jg4skhyh5kes7j5d5fd6xxloaytdywcvb3r3zrzhu';

export const sessionBody = () => ({
  did: DID,
  handle: HANDLE,
  accessJwt: fakeJwt('com.atproto.appPass'),
  refreshJwt: fakeJwt('com.atproto.refresh'),
  active: true,
});

export const createRecordBody = (rkey: string) => ({
  uri: `at://${DID}/app.bsky.feed.post/${rkey}`,
  cid: CID,
  commit: { cid: CID, rev: rkey },
  validationStatus: 'valid',
});

const TID_CHARS = '234567abcdefghijklmnopqrstuvwxyz';

/** A valid record key (TID) that is unique per `n`. */
export function tid(n: number): string {
  return `3k4duaz5vf${TID_CHARS[(n >> 10) & 31]}${TID_CHARS[(n >> 5) & 31]}${TID_CHARS[n & 31]}`;
}
