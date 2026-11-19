import { authenticationStoreContract } from '@nestjs/authentication/testing';
import { TypeOrmRefreshTokenStore } from '../src/modules/auth/stores/typeorm-refresh-token.store.js';
import { mockFetch } from './support/mock-fetch.js';
import { signUp, startTestApp, type TestApp } from './support/test-app.js';

/** Sign-up/sign-in, token rotation, workspace isolation and roles. */

let t: TestApp;

beforeAll(async () => {
  t = await startTestApp();
}, 60_000);

afterAll(() => t?.close());

describe('authentication', () => {
  it('requires a token everywhere except public routes', async () => {
    await t.http.get('/api/health').expect(200);
    await t.http.get('/api/integrations').expect(200);
    await t.http.get('/api/me').expect(401);
    await t.http.get('/api/workspaces').expect(401);
    await t.http
      .get('/api/workspaces/00000000-0000-4000-8000-000000000000/feed')
      .expect(401);
    await t.http
      .get('/api/me')
      .set('Authorization', 'Bearer not-a-jwt')
      .expect(401);
  });

  it('signs up with a first workspace, and never returns the password', async () => {
    const res = await t.http
      .post('/api/auth/signup')
      .send({
        email: '  Joel@Example.COM ',
        password: 'correct horse battery',
        name: 'Joel',
        workspaceName: 'Yo HQ',
      })
      .expect(201);
    expect(res.body.user).toMatchObject({
      email: 'joel@example.com',
      name: 'Joel',
    });
    expect(res.body.workspace).toMatchObject({ name: 'Yo HQ', role: 'owner' });
    expect(res.body.tokens).toMatchObject({
      tokenType: 'Bearer',
      expiresIn: 900,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|correct horse/);

    const [row]: { passwordHash: string }[] = await t.dataSource.query(
      `SELECT "passwordHash" FROM users WHERE email = 'joel@example.com'`,
    );
    expect(row.passwordHash).not.toContain('correct horse');
  });

  it('rejects duplicate emails (case-insensitive) and short passwords', async () => {
    await t.http
      .post('/api/auth/signup')
      .send({
        email: 'JOEL@example.com',
        password: 'another long pass',
        name: 'X',
      })
      .expect(409);
    await t.http
      .post('/api/auth/signup')
      .send({ email: 'new@example.com', password: 'short', name: 'X' })
      .expect(400);
  });

  it('signs in, with the same error for a wrong password or unknown email', async () => {
    const ok = await t.http
      .post('/api/auth/signin')
      .send({ email: 'joel@EXAMPLE.com', password: 'correct horse battery' })
      .expect(200);
    expect(ok.body.user.lastSignInAt).toBeTruthy();

    const wrong = await t.http
      .post('/api/auth/signin')
      .send({ email: 'joel@example.com', password: 'wrong password!' })
      .expect(401);
    const unknown = await t.http
      .post('/api/auth/signin')
      .send({ email: 'nobody@example.com', password: 'wrong password!' })
      .expect(401);
    expect(wrong.body.message).toBe(unknown.body.message);

    const me = await t.http
      .get('/api/me')
      .set('Authorization', `Bearer ${ok.body.tokens.accessToken}`)
      .expect(200);
    expect(me.body.workspaces).toEqual([
      expect.objectContaining({ name: 'Yo HQ', role: 'owner' }),
    ]);
  });

  it('rotates refresh tokens and signs out a device when one is reused', async () => {
    const user = await signUp(t.http);
    const first = await t.http
      .post('/api/auth/refresh')
      .send({ refreshToken: user.refreshToken })
      .expect(200);
    expect(first.body.refreshToken).not.toBe(user.refreshToken);

    // Replaying the spent token is treated as theft: the family is revoked,
    // so the newer token stops working too.
    await t.http
      .post('/api/auth/refresh')
      .send({ refreshToken: user.refreshToken })
      .expect(401);
    await t.http
      .post('/api/auth/refresh')
      .send({ refreshToken: first.body.refreshToken })
      .expect(401);
  });

  it('signs out one device', async () => {
    const user = await signUp(t.http);
    await t.http
      .post('/api/auth/signout')
      .send({ refreshToken: user.refreshToken })
      .expect(204);
    await t.http
      .post('/api/auth/refresh')
      .send({ refreshToken: user.refreshToken })
      .expect(401);
  });

  it('changing the password signs out every other device', async () => {
    const user = await signUp(t.http, 'Pat', 'pat@example.com');
    const otherDevice = await t.http
      .post('/api/auth/signin')
      .send({ email: 'pat@example.com', password: 'correct horse battery' })
      .expect(200);

    await t.http
      .post('/api/me/password')
      .set(user.auth)
      .send({
        currentPassword: 'nope nope nope',
        newPassword: 'a brand new passphrase',
      })
      .expect(400);
    const changed = await t.http
      .post('/api/me/password')
      .set(user.auth)
      .send({
        currentPassword: 'correct horse battery',
        newPassword: 'a brand new passphrase',
      })
      .expect(200);

    await t.http
      .post('/api/auth/refresh')
      .send({ refreshToken: otherDevice.body.tokens.refreshToken })
      .expect(401);
    await t.http
      .post('/api/auth/refresh')
      .send({ refreshToken: changed.body.refreshToken })
      .expect(200);
    await t.http
      .post('/api/auth/signin')
      .send({ email: 'pat@example.com', password: 'a brand new passphrase' })
      .expect(200);
  });

  it('updates the profile', async () => {
    const user = await signUp(t.http);
    const res = await t.http
      .patch('/api/me')
      .set(user.auth)
      .send({ name: '  New Name  ' })
      .expect(200);
    expect(res.body.name).toBe('New Name');
  });
});

describe('workspaces', () => {
  it('keeps each workspace private to its members', async () => {
    const alice = await signUp(t.http, 'Alice');
    const bob = await signUp(t.http, 'Bob');

    // Non-members get 404, not 403, so ids can't be probed.
    await t.http
      .get(`/api/workspaces/${alice.workspaceId}`)
      .set(bob.auth)
      .expect(404);
    await t.http
      .get(`/api/workspaces/${alice.workspaceId}/feed`)
      .set(bob.auth)
      .expect(404);

    // Alice's account can't be used from Bob's workspace.
    mockFetch({
      'GET mastodon.social/api/v1/accounts/verify_credentials': () => ({
        body: {
          id: '1',
          username: 'a',
          acct: 'a',
          display_name: 'A',
          url: 'u',
          avatar: 'v',
        },
      }),
    });
    const account = await t.http
      .post(`/api/workspaces/${alice.workspaceId}/accounts`)
      .set(alice.auth)
      .send({
        platform: 'mastodon',
        credentials: {
          instanceUrl: 'https://mastodon.social',
          accessToken: 'a'.repeat(40),
        },
      })
      .expect(201);
    vi.unstubAllGlobals();

    await t.http
      .post(`/api/workspaces/${bob.workspaceId}/posts`)
      .set(bob.auth)
      .send({ body: 'hi', targets: [{ accountId: account.body.id }] })
      .expect(404);
    await t.http
      .get(`/api/workspaces/${bob.workspaceId}/accounts/${account.body.id}`)
      .set(bob.auth)
      .expect(404);
  });

  it('enforces roles: viewer < editor < admin < owner', async () => {
    const owner = await signUp(t.http, 'Owner', 'owner@example.com');
    const member = await signUp(t.http, 'Member', 'member@example.com');
    const ws = `/api/workspaces/${owner.workspaceId}`;

    await t.http
      .post(`${ws}/members`)
      .set(owner.auth)
      .send({ email: 'MEMBER@example.com', role: 'viewer' })
      .expect(201);
    await t.http
      .post(`${ws}/members`)
      .set(owner.auth)
      .send({ email: 'member@example.com', role: 'viewer' })
      .expect(409);
    await t.http
      .post(`${ws}/members`)
      .set(owner.auth)
      .send({ email: 'ghost@example.com', role: 'viewer' })
      .expect(404);

    // Viewer: read only.
    await t.http.get(`${ws}/feed`).set(member.auth).expect(200);
    await t.http
      .post(`${ws}/posts`)
      .set(member.auth)
      .send({ body: 'x', targets: [] })
      .expect(403);

    // Editor: posts, but not accounts or members.
    await t.http
      .patch(`${ws}/members/${member.userId}`)
      .set(owner.auth)
      .send({ role: 'editor' })
      .expect(200);
    await t.http
      .post(`${ws}/accounts`)
      .set(member.auth)
      .send({ platform: 'mastodon', credentials: {} })
      .expect(403);
    await t.http
      .post(`${ws}/members`)
      .set(member.auth)
      .send({ email: 'owner@example.com', role: 'viewer' })
      .expect(403);

    // Admin: manages members, but can't hand out owner or touch owners.
    await t.http
      .patch(`${ws}/members/${member.userId}`)
      .set(owner.auth)
      .send({ role: 'admin' })
      .expect(200);
    await t.http
      .patch(`${ws}/members/${member.userId}`)
      .set(member.auth)
      .send({ role: 'owner' })
      .expect(403);
    await t.http
      .delete(`${ws}/members/${owner.userId}`)
      .set(member.auth)
      .expect(403);
    await t.http.delete(ws).set(member.auth).expect(403);

    const members = await t.http
      .get(`${ws}/members`)
      .set(member.auth)
      .expect(200);
    expect(members.body.map((m: { role: string }) => m.role)).toEqual([
      'owner',
      'admin',
    ]);

    // The member's own workspace list now has both.
    const list = await t.http
      .get('/api/workspaces')
      .set(member.auth)
      .expect(200);
    expect(list.body.map((w: { role: string }) => w.role).sort()).toEqual([
      'admin',
      'owner',
    ]);

    // Leaving is always allowed (except for the last owner).
    await t.http
      .delete(`${ws}/members/${member.userId}`)
      .set(member.auth)
      .expect(204);
    await t.http.get(ws).set(member.auth).expect(404);
  });

  it('never leaves a workspace without an owner', async () => {
    const owner = await signUp(t.http);
    const ws = `/api/workspaces/${owner.workspaceId}`;
    await t.http
      .delete(`${ws}/members/${owner.userId}`)
      .set(owner.auth)
      .expect(400);
    await t.http
      .patch(`${ws}/members/${owner.userId}`)
      .set(owner.auth)
      .send({ role: 'admin' })
      .expect(400);
  });

  it('creates, renames and deletes a workspace with everything in it', async () => {
    const user = await signUp(t.http);
    const created = await t.http
      .post('/api/workspaces')
      .set(user.auth)
      .send({ name: 'Side project' })
      .expect(201);
    const ws = `/api/workspaces/${created.body.id}`;
    await t.http.patch(ws).set(user.auth).send({ name: 'Renamed' }).expect(200);
    await t.http.delete(ws).set(user.auth).expect(204);
    await t.http.get(ws).set(user.auth).expect(404);
  });
});

describe('account deletion', () => {
  it('needs the right password', async () => {
    const user = await signUp(t.http);
    await t.http
      .delete('/api/me')
      .set(user.auth)
      .send({ password: 'not my password' })
      .expect(400);
    await t.http.get('/api/me').set(user.auth).expect(200);
  });

  it('refuses while a shared workspace would be left without an owner', async () => {
    const owner = await signUp(
      t.http,
      'Shared Owner',
      `shared-owner-${Date.now()}@example.com`,
    );
    const mate = await signUp(t.http, 'Mate', `mate-${Date.now()}@example.com`);
    const ws = `/api/workspaces/${owner.workspaceId}`;
    const me = await t.http.get('/api/me').set(mate.auth).expect(200);
    await t.http
      .post(`${ws}/members`)
      .set(owner.auth)
      .send({ email: me.body.user.email, role: 'editor' })
      .expect(201);

    const res = await t.http
      .delete('/api/me')
      .set(owner.auth)
      .send({ password: 'correct horse battery' })
      .expect(409);
    expect(res.body.message).toMatch(/Make someone else an owner/);

    await t.http
      .patch(`${ws}/members/${mate.userId}`)
      .set(owner.auth)
      .send({ role: 'owner' })
      .expect(200);
    await t.http
      .delete('/api/me')
      .set(owner.auth)
      .send({ password: 'correct horse battery' })
      .expect(204);

    // The shared workspace survives for the remaining owner.
    await t.http.get(ws).set(mate.auth).expect(200);
    const members = await t.http
      .get(`${ws}/members`)
      .set(mate.auth)
      .expect(200);
    expect(members.body.map((m: { userId: string }) => m.userId)).toEqual([
      mate.userId,
    ]);
  });

  it('deletes the user, their solo workspaces and every session', async () => {
    const user = await signUp(
      t.http,
      'Leaver',
      `leaver-${Date.now()}@example.com`,
    );
    mockFetch({
      'GET mastodon.social/api/v1/accounts/verify_credentials': () => ({
        body: {
          id: '77',
          username: 'leaver',
          acct: 'leaver',
          display_name: 'L',
          url: 'u',
          avatar: 'v',
        },
      }),
    });
    await t.http
      .post(`/api/workspaces/${user.workspaceId}/accounts`)
      .set(user.auth)
      .send({
        platform: 'mastodon',
        credentials: {
          instanceUrl: 'https://mastodon.social',
          accessToken: 'l'.repeat(40),
        },
      })
      .expect(201);
    vi.unstubAllGlobals();

    await t.http
      .delete('/api/me')
      .set(user.auth)
      .send({ password: 'correct horse battery' })
      .expect(204);

    await t.http.get('/api/me').set(user.auth).expect(401);
    await t.http
      .post('/api/auth/refresh')
      .send({ refreshToken: user.refreshToken })
      .expect(401);
    const [counts]: {
      users: number;
      workspaces: number;
      accounts: number;
      tokens: number;
    }[] = await t.dataSource.query(
      `SELECT (SELECT count(*) FROM users WHERE id = $1::uuid)::int AS users,
              (SELECT count(*) FROM workspaces WHERE id = $2)::int AS workspaces,
              (SELECT count(*) FROM social_accounts WHERE "workspaceId" = $2)::int AS accounts,
              (SELECT count(*) FROM auth_refresh_tokens WHERE "userId" = $1::text)::int AS tokens`,
      [user.userId, user.workspaceId],
    );
    expect(counts).toEqual({ users: 0, workspaces: 0, accounts: 0, tokens: 0 });
  });
});

describe('TypeOrmRefreshTokenStore', () => {
  it('passes the @nestjs/authentication store contract', async () => {
    const cases = authenticationStoreContract(
      async () => {
        await t.dataSource.query(
          'TRUNCATE auth_refresh_tokens, auth_revoked_token_families',
        );
        return { refreshTokens: new TypeOrmRefreshTokenStore(t.dataSource) };
      },
      { contracts: ['refreshTokens'] },
    );
    expect(cases.length).toBeGreaterThan(0);
    for (const c of cases) {
      await c.run().catch((error: unknown) => {
        throw new Error(`${c.name}: ${String(error)}`);
      });
    }
  });
});
