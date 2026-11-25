# Yo Socials API

NestJS backend that connects social accounts, plans content with Gemini, publishes on schedule, and tracks how each post performs.

## Run it

```bash
cp .env.example .env        # then fill in DATABASE_URL, CREDENTIALS_ENCRYPTION_KEY, JWT_SECRET, GEMINI_API_KEY
npm install
npm run start:dev           # http://localhost:4000/api, docs at /api/docs
```

Locally, migrations run automatically on start (`DATABASE_RUN_MIGRATIONS=true`).
On Vercel, automatic migrations and the publish/metrics cron jobs are always
off, whatever `DATABASE_RUN_MIGRATIONS` and `SCHEDULER_ENABLED` say: cold
starts would race each other migrating, and cron never fires while a function
sleeps. Apply production migrations once per release from the API project root
with `npm run migration:run` and the production database environment variables.

On Vercel the database connection fails fast (10s timeout, one retry) so a
misconfiguration shows up in the function logs instead of as a slow cold start.
`DATABASE_SSL=true` verifies the server certificate strictly, which the
Supabase pooler's self-signed chain fails; keep it `false` for Supabase.

No Postgres yet? `npm run db:local` starts an in-memory one on port 5433. Point `DATABASE_URL` at `postgres://postgres:postgres@127.0.0.1:5433/postgres`. Its data is lost when it stops.

## Auth and workspaces

Every route needs `Authorization: Bearer <accessToken>`, except `/api/health`, `/api/integrations` and `/api/auth/*`.

1. `POST /api/auth/signup` `{ email, password, name, workspaceName? }`: creates the user and their first workspace, and returns tokens.
2. `POST /api/auth/signin` returns `{ user, tokens }`. Access tokens last 15 minutes.
3. `POST /api/auth/refresh` `{ refreshToken }` returns a new pair. Refresh tokens work once each. Reusing an old one signs out that device.
4. `POST /api/auth/signout` `{ refreshToken }`. `POST /api/me/password` changes the password and signs out every other device.

Everything else lives under `/api/workspaces/:workspaceId/...`: accounts, posts, feed, calendar, analytics and agent. Non-members get 404.

| Role | Can |
| --- | --- |
| viewer | read the feed, calendar, analytics, posts and accounts |
| editor | + create, edit, schedule and publish posts; use the agent |
| admin | + connect and remove accounts; add, change and remove members; rename the workspace |
| owner | + delete the workspace; manage other owners. A workspace always keeps at least one owner. |

Members are added by email, and the person needs an account first. Sign-in and sign-up are rate limited per IP (`AUTH_RATE_LIMIT_PER_MINUTE`).

## AI model

`GEMINI_MODEL` (default `gemini-3.5-flash-lite`) is tried first, then each of `GEMINI_FALLBACK_MODELS` in order. The agent moves to the next model when one is overloaded (429/5xx), unreachable, or takes longer than 45s. Which models exist depends on your API key, so check yours with:

```bash
curl -s -H "x-goog-api-key: $GEMINI_API_KEY" https://generativelanguage.googleapis.com/v1beta/models | grep '"name"'
```

## Layout

```
src/
  config/            env validation (the app won't boot with bad config)
  database/          TypeORM options, entity list, migrations
  common/            base entity, AES-GCM credential encryption, typed HTTP client
  modules/
    users/           user entity and lookups (passwords hashed with scrypt)
    auth/            sign-up/in, JWT + rotating refresh tokens (@nestjs/authentication), /me
    workspaces/      workspaces, members, roles, WorkspaceAccessGuard
    integrations/    PlatformProvider interface + one provider per platform
    accounts/        connect / verify / remove accounts (credentials encrypted)
    posts/           posts and their per-account targets (drafts, scheduling)
    publishing/      publish now + cron scheduler, retries, double-post protection
    analytics/       metric snapshots over time, overview, top posts
    feed/            unified feed across accounts + content calendar
    agent/           Gemini planning: calendar → draft posts, per-platform variants
```

Each module keeps `entities/`, `dto/`, `enums/` or `interfaces/` apart from its `*.service.ts` and `*.controller.ts`.

## Data model

- **User**, **Workspace**, **WorkspaceMember** (with role): who can see and do what. Accounts and posts belong to a workspace, and deleting the workspace deletes them.
- **SocialAccount**: one connected account or channel. Holds the persona, brand voice and encrypted credentials.
- **Post**: one piece of content (`title`, `body`).
- **PostTarget**: that post on one account. It has its own text, `scheduledAt`, status, publish result and latest metrics. The feed and the calendar both read from this table.
- **PostMetricSnapshot**: engagement for a target at one point in time, so you can see how a post moved after publishing.

Target lifecycle: `draft → scheduled → publishing → published | failed`. Agent output always lands as `draft`. Nothing publishes until someone calls `POST /posts/:id/schedule` or `POST /posts/:id/publish`.

## Platforms

| Platform | Credentials | Metrics |
| --- | --- | --- |
| Bluesky | handle + app password, via the official SDK (see below) | likes, reposts, replies, quotes |
| Mastodon | instance URL + access token (`read:accounts read:statuses write:statuses`) | favourites, boosts, replies |
| Telegram | bot token + channel; the bot must be an admin that can post | none (the Bot API can't read view counts) |
| Discord | channel webhook URL | reaction count |

### Bluesky

Built on the official SDK, following the [Bluesky API docs](https://bsky.network/docs/bluesky-api/): `@bsky/sdk`, `@atproto/lex` and `@atproto/lex-password-session`.

- **Sessions:** `PasswordSession` signs in with an app password, never the main password. The session (access and refresh JWTs) is stored encrypted in `provider_sessions` and resumed with `PasswordSession.resume()`; `onUpdated` saves every refresh. We log in again only when the stored session is revoked, because `createSession` is tightly rate limited. Disconnecting an account deletes the session on Bluesky.
- **Requests:** lexicon calls (`getProfile`, `getPosts`) go through the user's PDS with `atproto-proxy: did:web:api.bsky.app#bsky_appview`, the client pinned to `api.app.service` as the docs recommend. Record writes (`post`) go straight to the PDS.
- **Posts:** `RichText.detectFacets()` turns links, @mentions and #hashtags into facets. The first link gets a website card (`app.bsky.embed.external`): we fetch its Open Graph data and upload the thumbnail with `uploadBlob`, re-encoded to JPEG under 1 MB so EXIF/GPS metadata is stripped.
- **Link safety:** the URLs come from users, so `link-preview/safe-fetch.ts` only connects to public IPs. Each resolved address is checked inside the connection's own DNS lookup, so DNS rebinding can't get past it. It also only allows ports 80/443, re-validates every redirect, and caps size and time.
- **Errors:** XRPC errors map to our retry and "needs reconnect" logic. `@atproto/lex` and `lex-password-session` ship separate error classes, so they're matched by shape, not `instanceof`.

To add a platform: add it to `common/enums/platform.enum.ts`, implement `PlatformProvider` in `modules/integrations/providers/<name>/`, and register it in `integrations.module.ts` and `integrations.registry.ts`. Then run `npm run migration:generate src/database/migrations/Add<Name>` to update the enum, and add the migration to `database/migrations/index.ts`.

## Scripts

| Script | What it does |
| --- | --- |
| `npm test` | unit tests (providers, facets, crypto, status logic) |
| `npm run test:e2e` | full flow against in-memory Postgres with stubbed platforms and a fake model |
| `npm run migration:generate src/database/migrations/<Name>` | diff entities against the DB |
| `npm run migration:run` / `migration:revert` | apply / undo |
| `npx typeorm migration:generate -d dist/database/data-source.js x --check` | confirm the database matches the entities (after `nest build`) |

## Not built yet

- Email: password reset, email verification and invitations for people without an account. `@nestjs/authentication` has handlers for these once an email sender is set up.
- Media uploads (images and video).
- OAuth platforms: Meta, X, LinkedIn, TikTok and YouTube.
