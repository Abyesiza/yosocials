# Aby Socials API

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
- **Post**: one piece of content (`title`, `body`, `media`: one video or up to 35 images, stored on UploadThing).
- **PostTarget**: that post on one account. It has its own text, platform `options` (TikTok privacy and interactions), `scheduledAt`, status, publish result and latest metrics. The feed and the calendar both read from this table.
- **PostMetricSnapshot**: engagement for a target at one point in time, so you can see how a post moved after publishing.

Target lifecycle: `draft → scheduled → publishing → published | failed`. Platforms that finish publishing on their own time (TikTok) go `publishing → processing → published | failed`; the scheduler, or `POST /posts/:id/sync` from the post page, checks on them. Agent output always lands as `draft`. Nothing publishes until someone calls `POST /posts/:id/schedule` or `POST /posts/:id/publish`.

## Platforms

| Platform | Credentials | Metrics |
| --- | --- | --- |
| Bluesky | handle + app password, via the official SDK (see below) | likes, reposts, replies, quotes |
| Mastodon | instance URL + access token (`read:accounts read:statuses write:statuses`) | favourites, boosts, replies |
| Telegram | bot token + channel; the bot must be an admin that can post | none (the Bot API can't read view counts) |
| Discord | channel webhook URL | reaction count |
| TikTok | OAuth sign-in (“Continue with TikTok”); needs a video or photos | views, likes, comments, shares |
| X | OAuth 2.0 sign-in with PKCE (“Continue with X”); text, up to 4 photos or 1 video | impressions (as views), likes, reposts, replies, quotes |
| LinkedIn | OAuth sign-in (“Continue with LinkedIn”) to a member profile; text, up to 20 photos or 1 MP4 video | impressions (as views), reactions, comments, reposts, once `r_member_postAnalytics` is approved |

### Bluesky

Built on the official SDK, following the [Bluesky API docs](https://bsky.network/docs/bluesky-api/): `@bsky/sdk`, `@atproto/lex` and `@atproto/lex-password-session`.

- **Sessions:** `PasswordSession` signs in with an app password, never the main password. The session (access and refresh JWTs) is stored encrypted in `provider_sessions` and resumed with `PasswordSession.resume()`; `onUpdated` saves every refresh. We log in again only when the stored session is revoked, because `createSession` is tightly rate limited. Disconnecting an account deletes the session on Bluesky.
- **Requests:** lexicon calls (`getProfile`, `getPosts`) go through the user's PDS with `atproto-proxy: did:web:api.bsky.app#bsky_appview`, the client pinned to `api.app.service` as the docs recommend. Record writes (`post`) go straight to the PDS.
- **Posts:** `RichText.detectFacets()` turns links, @mentions and #hashtags into facets. The first link gets a website card (`app.bsky.embed.external`): we fetch its Open Graph data and upload the thumbnail with `uploadBlob`, re-encoded to JPEG under 1 MB so EXIF/GPS metadata is stripped.
- **Link safety:** the URLs come from users, so `link-preview/safe-fetch.ts` only connects to public IPs. Each resolved address is checked inside the connection's own DNS lookup, so DNS rebinding can't get past it. It also only allows ports 80/443, re-validates every redirect, and caps size and time.
- **Errors:** XRPC errors map to our retry and "needs reconnect" logic. `@atproto/lex` and `lex-password-session` ship separate error classes, so they're matched by shape, not `instanceof`.

### TikTok

Built on the [Content Posting API](https://developers.tiktok.com/doc/content-posting-api-get-started) and Login Kit.

- **Connecting:** `POST /accounts/oauth/tiktok/start` returns TikTok’s authorize URL with a signed, 15-minute `state` bound to the workspace and user. TikTok redirects to the web app (`/integrations/tiktok/callback`), which checks the state against an httpOnly cookie and posts the code to `POST /accounts/oauth/tiktok/callback`. Tokens are stored encrypted in `provider_sessions` and refreshed before they expire. Disconnecting revokes them, unless another workspace uses the same TikTok account.
- **Posting:** per target, `options.mode` is `direct` (Direct Post, `video.publish`) or `inbox` (a draft the creator finishes in TikTok, `video.upload`). Direct posts re-query creator info first and respect the creator’s privacy options, comment/Duet/Stitch settings and maximum video length. Media is uploaded from the browser to UploadThing through the web app’s `/api/uploadthing` route, which asks `POST /media/uploads` to authorize the editor and name each file `<workspaceId>_<uuid>.<ext>`. TikTok pulls it from `MEDIA_PUBLIC_BASE_URL` (`abysocials.com/media/<id>`, proxied to `<appId>.ufs.sh/f/<id>`), so that domain must be verified on the TikTok app (URL properties).
- **Status:** TikTok publishes asynchronously. Targets stay `processing` until the status endpoint reports `PUBLISH_COMPLETE` (or the creator posts the inbox draft). Video ids are 19-digit numbers, parsed as strings so they aren’t rounded.
- **Review:** until TikTok audits the app, Direct Posts can only be private (“Only me”).

### X

Built on the X API v2, following [api.x.com/2/openapi.json](https://api.x.com/2/openapi.json) and the [OAuth 2.0 PKCE guide](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code).

- **Setup:** a Web App (confidential client) in the X developer console with `X_REDIRECT_URI` (`https://abysocials.com/integrations/x/callback`) registered as a callback URL. Set `X_CLIENT_ID`, `X_CLIENT_SECRET` and `X_REDIRECT_URI`; `X_SCOPES` defaults to `tweet.read tweet.write users.read media.write offline.access` (space-separated; `offline.access` gives the refresh token scheduled posts need).
- **Connecting:** the same signed-state flow as TikTok, plus PKCE (S256). The code verifier is an HMAC of the signed state, so nothing is stored between the redirect and the callback. The code is exchanged with HTTP Basic client auth; `/2/users/me` then names the account. Tokens (two-hour access, rotating refresh) are stored encrypted in `provider_sessions` under `x:<user id>`. Refreshes run under a Postgres advisory lock, because X invalidates a refresh token once it's used. Disconnecting revokes both tokens.
- **Posting:** `POST /2/tweets`. X can't pull media from a URL, so files are read from `MEDIA_PUBLIC_BASE_URL` and uploaded: photos with one `POST /2/media/upload` (5 MB limit), videos streamed in 4 MB chunks (`initialize` → `append` → `finalize`), then polled until processed (up to 5 minutes). Text is limited to 280 in X's weighted count (`common/text/text-length.ts`: links 23, emoji and CJK 2). Duplicate-content rejections fail the post without flagging the account for reconnecting.
- **Metrics:** `GET /2/tweets` in batches of 100 with `public_metrics,non_public_metrics,organic_metrics` (private metrics cover our own posts from the last 30 days, matching the tracking window). Impressions are stored as views; the private counters (link and profile clicks) stay in the snapshot's `raw`.
- **Cost:** X bills every request from prepaid credits (posts with links cost more), so X metrics are read every 6 hours (`metricsIntervalMinutes`) instead of every 30 minutes. Set a spending limit in the developer console.

### LinkedIn

Built on the [Posts, Images and Videos APIs](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api) (versioned `/rest` endpoints) and [Sign In with LinkedIn using OpenID Connect](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2).

- **Setup:** on the LinkedIn app, add the products *Sign In with LinkedIn using OpenID Connect* (`openid`, `profile`) and *Share on LinkedIn* (`w_member_social`), and register `LINKEDIN_REDIRECT_URI` under Auth → Authorized redirect URLs. `LINKEDIN_SCOPES` defaults to `openid profile w_member_social`; the old `r_liteprofile`/`r_emailaddress` scopes are retired and rejected at startup. `LINKEDIN_API_VERSION` (`YYYYMM`, default `202611`) goes in the `LinkedIn-Version` header; LinkedIn retires each version about a year after release, so bump it yearly.
- **Connecting:** the same signed-state flow as TikTok (web apps use the client secret, not PKCE). `/v2/userinfo` gives the member id (`sub`, so the author is `urn:li:person:<sub>`), name and picture; OpenID Connect has no vanity URL, so accounts have no profile link. Tokens are stored encrypted under `linkedin:<sub>`.
- **Tokens:** access tokens last 60 days. Self-serve apps get no refresh token, so when one expires the account is marked “Needs reconnecting” and the member connects again (LinkedIn skips the consent screen if they're still signed in). Apps approved for programmatic refresh get a refresh token, which is used under the session lock; it doesn't rotate and keeps its original one-year expiry. LinkedIn has no revoke endpoint for this flow, so disconnecting forgets the token and members remove access under Settings → Data privacy → Permitted services.
- **Posting:** `POST /rest/posts`; the post URN comes back in `x-restli-id` and links to `linkedin.com/feed/update/<urn>/`. Text is converted to LinkedIn's “little” format (`linkedin-text.ts`): reserved characters are escaped, hashtags kept. Photos (JPEG, PNG, GIF; no WebP) and videos (MP4, up to 500 MB, 3 seconds to 30 minutes) are read from `MEDIA_PUBLIC_BASE_URL` and PUT to LinkedIn's signed upload URLs; two or more photos make a multi-image post. Videos stream in the 4 MB parts LinkedIn asks for, are finalized with the parts' ETags, and are waited on (up to 4 minutes) where the token may read them.
- **Analytics:** `memberCreatorPostAnalytics` needs `r_member_postAnalytics`, part of the Community Management API, which LinkedIn must approve. Until the scope is approved and added to `LINKEDIN_SCOPES` (members then reconnect), LinkedIn posts show no metrics. With it, each post costs 4 calls (impressions, reactions, comments, reposts), so they're read every 6 hours. Company Page posting (`w_organization_social`) is also Community Management API only.

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
- Media for text platforms: Bluesky, Mastodon, Telegram and Discord still get the text only.
- More OAuth platforms: Meta, X, LinkedIn and YouTube.
