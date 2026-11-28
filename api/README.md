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

`PATCH /api/workspaces/:id` (admin) takes any of `{ name, audienceCountry, audienceTimeZone }`: the audience's country (ISO 3166-1 alpha-2, e.g. `UG`; `null` clears it) and IANA time zone (default `UTC`). Suggested times, the scheduling guard's wording and the AI planner all use them.

Members are added by email, and the person needs an account first. Sign-in and sign-up are rate limited per IP (`AUTH_RATE_LIMIT_PER_MINUTE`).

## AI model

`GEMINI_MODEL` (default `gemini-3.5-flash-lite`) is tried first, then each of `GEMINI_FALLBACK_MODELS` in order. The agent moves to the next model when one is overloaded (429/5xx), unreachable, or takes longer than 45s. Which models exist depends on your API key, so check yours with:

```bash
curl -s -H "x-goog-api-key: $GEMINI_API_KEY" https://generativelanguage.googleapis.com/v1beta/models | grep '"name"'
```

### Web search

`GEMINI_SEARCH_GROUNDING` (default `false`) lets the model search the web first ([Grounding with Google Search](https://ai.google.dev/gemini-api/docs/google-search)), through `LanguageModel.generateGrounded`. `canSearchWeb` is true only when it's on and `GEMINI_API_KEY` is set. Leave it off on a free-tier key: Gemini 3 models get no grounding there. The paid tier includes 5,000 search queries a month, then about $14 per 1,000, capped by default at 1,500 search requests a day per project.

Grounded calls send `tools: [{ googleSearch: {} }]` with the usual JSON schema, use the same model fallback, and get 90s per attempt instead of 45s because searching comes first. They return `{ data, grounding }`, where `grounding` holds Google's rendered Search Suggestions (`searchEntryPointHtml`), the `sources` and the `queries`, or is null when the model didn't search. Google's terms require showing the Search Suggestions and sources, unmodified, to the person who asked, and never caching them for anyone else.

## Trends

`GET /api/workspaces/:workspaceId/trends?country=UG` (any member) returns what's trending for an audience country, as a `TrendSnapshot`: `{ country, updatedAt, items[], notes[] }`. Each item has `source`, `scope` (`country` or `global`), `term`, `traffic`, `url`, related `news` headlines and `observedAt`. `country` is required and must be an ISO 3166-1 alpha-2 code.

| Source | Scope | Notes |
| --- | --- | --- |
| Google Trends “Trending now” RSS (`trends.google.com/trending/rss?geo=XX`) | country | Unofficial and undocumented, so it may change or vanish. About 10 items with approximate searches and news headlines. Some countries have no list (Rwanda answers 400). |
| Mastodon trending tags (`mastodon.social/api/v1/trends/tags`) | global | Public, no key. `traffic` is the tag's uses on the latest day. mastodon.social only, not the whole fediverse. |
| Bluesky trending topics (`app.bsky.unspecced.getTrendingTopics` on `public.api.bsky.app`) | global | Public, no key. “Unspecced” means Bluesky may change it at any time. No traffic. |

- **Failures:** each source has a 5s timeout and fails on its own. A failure is logged as a warning and becomes a plain note in `notes`; the request never fails because of it.
- **Caching:** in memory, per instance, for 3 hours (a failed source is retried after 10 minutes). Google Trends is cached per country, Mastodon and Bluesky once for every country. Concurrent requests share one fetch. Trends are public data, so one cache serves every workspace.
- **Feed content is untrusted:** XML entities and CDATA are decoded, markup and control characters stripped, and only http(s) links kept, so everything is plain text.
- **For prompts:** `TrendsService.digest(snapshot)` makes a compact list (up to 15 items, taking sources in turn) that tells the model to use a trend only when it fits the brief and never to invent facts about it. `TREND_GUIDANCE` (`modules/trends/trend-guidance.ts`) has per-platform advice.
- **Not possible, or skipped on purpose:** TikTok has no legitimate API for trending sounds, and business accounts may only use the Commercial Music Library, so the AI suggests formats, hooks and hashtags and the person picks a sound in the TikTok app (Creative Center shows what's trending). X trends are skipped because X charges for them.

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
    scheduling/      slot finder: suggested times, the scheduling guard, planner times
    agent/           Gemini planning: calendar → draft posts, per-platform variants
    trends/          what's trending per country (Google Trends, Mastodon, Bluesky)
```

Each module keeps `entities/`, `dto/`, `enums/` or `interfaces/` apart from its `*.service.ts` and `*.controller.ts`.

## Data model

- **User**, **Workspace**, **WorkspaceMember** (with role): who can see and do what. Accounts and posts belong to a workspace, and deleting the workspace deletes them.
- **SocialAccount**: one connected account or channel. Holds the persona, brand voice and encrypted credentials.
- **Post**: one piece of content (`title`, `body`, `media`: one video or up to 35 images, stored on UploadThing).
- **PostTarget**: that post on one account. It has its own text, platform `options` (TikTok privacy and interactions), `scheduledAt` (with `scheduleReason` when Aby Socials picked the time; cleared when a person changes it), status, publish result and latest metrics. The feed and the calendar both read from this table.
- **PostMetricSnapshot**: engagement for a target at one point in time, so you can see how a post moved after publishing.

Target lifecycle: `draft → scheduled → publishing → published | failed`. Platforms that finish publishing on their own time (TikTok) go `publishing → processing → published | failed`; the scheduler, or `POST /posts/:id/sync` from the post page, checks on them. Agent output always lands as `draft`. Nothing publishes until someone calls `POST /posts/:id/schedule` or `POST /posts/:id/publish`.

## Scheduling

Each provider declares `capabilities.posting` (`PostingPolicy`, published by `GET /integrations`): `maxPerDay`, `minSpacingMinutes`, weighted `windows` and `avoid` times in the audience's local time, the `source` of the windows and the platform's own `limits`. The windows are starting points, not rules: the studies behind them (Buffer, Sprout Social, Hootsuite, Later, 2025–2026) report audience-local times and aren't African, so each account's own results should re-rank them over time.

| Platform | Per day | Apart | Windows from |
| --- | --- | --- | --- |
| X | 3 | 2 hours | Buffer 2026 (8.7M posts), Hootsuite 2025, Sprout Social 2026: weekday mornings |
| LinkedIn | 1 | 18 hours | Sprout Social 2026, Buffer 2026 (4.8M posts), Later 2026: weekday late morning to late afternoon |
| TikTok | 3 | 3 hours | Buffer 2026 (7.1M posts), Later 2026, Sprout Social 2026, Hootsuite 2025: evenings, weekend mornings |
| Bluesky | 3 | 2 hours | Buffer 2026 (3M+ posts), SocialPilot: evenings and weekends |
| Mastodon | 3 | 90 minutes | no published study; feeds are chronological, so waking hours |
| Telegram | 3 | 2 hours | no published study; every post notifies subscribers, so daytime and evening |
| Discord | 1 | 24 hours | no published study; Discord advises few announcements, so member evenings |

The comment above each provider's `posting` says where its numbers come from.

- **Slot finder** (`modules/scheduling/slot-finder.ts`): scores every quarter hour in the window by the platform's `windows` weight in the audience time zone (`Intl`, so DST zones like Europe/London are right), skips `avoid` times and anything under 10 minutes away, and nudges each time by 1–3 minutes (a stable hash of account and time) so posts don't all fire on the hour. It keeps `maxPerDay` per audience-local day and `minSpacingMinutes` against the account's scheduled, publishing, processing and published posts (`publishedAt`, else `scheduledAt`) and the times it has already handed out. Asked for several, it takes the strongest day first, one per day, and only comes back for a second time on a day once every day has one. Each time comes with a reason: “Tuesday 09:02 (EAT) is one of X’s strongest times. Source: Buffer 2026, Hootsuite 2025 and Sprout Social 2026 studies of X posts.” Zone names come from ICU, except African zones, which ICU calls “GMT+3”, so EAT, CAT, SAST and WAT are named in `time-zone.ts`.
- **Suggestions:** `POST /workspaces/:id/schedule/suggestions` (editor) `{ accountIds (1–20), from?, days? (1–31, default 7), count? (1–10 per account, default 3), timeZone? (default the workspace's) }` returns `{ timeZone, suggestions: [{ accountId, platform, at, reason }] }`, per account in the order asked, earliest first. Fewer come back when the caps leave no room.
- **Guard:** a target becoming `scheduled` or moving while scheduled (creating a post with a time, `POST /posts/:id/schedule`, which also approves AI plans, and `PATCH /posts/:id/targets/:targetId`) is refused when it would break the account's daily cap or spacing. The message names the rule and offers the next free time within 14 days, in the workspace's time zone: “LinkedIn posts from Aby Creator are kept at least 18 hours apart, and another is scheduled at Tue 2 Dec, 10:00 EAT. The next free time is Wed 3 Dec, 11:02 EAT.” Drafts aren't checked, and neither is publishing now: a person chose to post now, and the caps are well inside each platform's own limits, which the platform still enforces.
- **AI planner:** the model picks a `date` per target, never a time. The engine gives each target its account's best free time on or after that date, earliest dates first and within the caps (existing posts included), and stores the reason. A target with no free time left in the plan is skipped with a plain reason. The plan's time zone and country default to the workspace's (`timezone` and `country` override them), and the prompt tells the model each platform's daily cap.
- **Slow-down signals:** on a 429, `PlatformApiError.retryAfterMs` carries the platform's wait (`Retry-After`, Discord's `retry_after`, Telegram's `parameters.retry_after`, X's `x-rate-limit-reset`, Mastodon's `X-RateLimit-Reset`). A retryable failure goes back on the schedule after the longer of our backoff (2, 4, 8 minutes) and that wait, up to 3 attempts. TikTok's `spam_risk_too_many_posts` (the creator's daily cap) moves the post to the account's best free time the next day, with a note in `lastError`, instead of failing it; it counts as an attempt.

## Platforms

| Platform | Credentials | Metrics |
| --- | --- | --- |
| Bluesky | handle + app password, via the official SDK (see below); text, up to 4 photos or 1 MP4 video | likes, reposts, replies, quotes |
| Mastodon | instance URL + access token (`read:accounts read:statuses write:statuses write:media`); text, up to 4 photos or 1 video | favourites, boosts, replies |
| Telegram | bot token + channel; the bot must be an admin that can post; text, up to 10 photos or 1 MP4 video | none (the Bot API can't read view counts) |
| Discord | channel webhook URL; text, up to 10 photos or 1 MP4 video | reaction count |
| TikTok | OAuth sign-in (“Continue with TikTok”); needs a video or photos | views, likes, comments, shares |
| X | OAuth 2.0 sign-in with PKCE (“Continue with X”); text, up to 4 photos or 1 video | impressions (as views), likes, reposts, replies, quotes |
| LinkedIn | OAuth sign-in (“Continue with LinkedIn”) to a member profile; text, up to 20 photos or 1 MP4 video | impressions (as views), reactions, comments, reposts, once `r_member_postAnalytics` is approved |

### Media: one copy per platform

Platforms disagree on sizes and shapes (TikTok wants 9:16 and photos within 1080p, X caps video at 1280×1024 and photos at 5 MB, Bluesky photos at 2 MB, LinkedIn takes no WebP, Discord fits 25 MiB in a message), so each platform gets its own copy of every photo and video.

- **Specs:** each provider declares `capabilities.media.imageSpec` / `videoSpec` (formats, codecs, byte limit, long/short side, pixel and side-sum limits, aspect range or preferred shape, duration, fps), with the source it came from. `GET /integrations` publishes them.
- **Copies:** the web app (`app/lib/media/plan.ts`, `prepare.ts`) uploads the original, then works out per platform whether the original fits; where it doesn't, it renders a copy in the browser (photos as JPEG within the byte budget, videos as H.264/AAC MP4 at a bitrate that fits the size limit) and uploads it. Platforms needing the same size and shape share one copy. Where a platform prefers another shape, the person chooses fit (blurred backdrop), fill (crop) or original. Adding an account later makes the missing copies from the attached original.
- **Storage:** `posts.media[]` keeps the original's path, size and dimensions plus `variants[]` (platform, path, contentType, size, width, height). Copies must be uploads from the same workspace and the same kind as the original. Deleting a post or removing media deletes every copy.
- **Publishing:** `PublishInput.media` holds the copy for the target's platform (`mediaFor`), and `mediaIssues` (`modules/integrations/media-spec.ts`) checks it against the spec before scheduling and again before sending. Feed items show the account's platform copy; post responses include all copies.

### Bluesky

Built on the official SDK, following the [Bluesky API docs](https://bsky.network/docs/bluesky-api/): `@bsky/sdk`, `@atproto/lex` and `@atproto/lex-password-session`.

- **Sessions:** `PasswordSession` signs in with an app password, never the main password. The session (access and refresh JWTs) is stored encrypted in `provider_sessions` and resumed with `PasswordSession.resume()`; `onUpdated` saves every refresh. We log in again only when the stored session is revoked, because `createSession` is tightly rate limited. Disconnecting an account deletes the session on Bluesky.
- **Requests:** lexicon calls (`getProfile`, `getPosts`) go through the user's PDS with `atproto-proxy: did:web:api.bsky.app#bsky_appview`, the client pinned to `api.app.service` as the docs recommend. Record writes (`post`) go straight to the PDS.
- **Posts:** `RichText.detectFacets()` turns links, @mentions and #hashtags into facets. The first link gets a website card (`app.bsky.embed.external`): we fetch its Open Graph data and upload the thumbnail with `uploadBlob`, re-encoded to JPEG under 1 MB so EXIF/GPS metadata is stripped.
- **Media:** photos (JPEG, PNG, WebP, up to 2 MB and 2048 px a side) go up with `uploadBlob` and are embedded with `app.bsky.embed.images`, up to 4, each with its aspect ratio. A video (MP4, H.264, up to 300 MB) goes through Bluesky's video service, as [the video docs](https://bsky.network/docs/about-bluesky-content/video) recommend: `getUploadLimits` first (accounts need a verified email, and there's a daily limit), a `getServiceAuth` token for the user's PDS (`did:web:<pds host>`, `com.atproto.repo.uploadBlob`), the raw upload to `video.bsky.app/xrpc/app.bsky.video.uploadVideo`, then `getJobStatus` until the blob is ready (up to 4 minutes), embedded with `app.bsky.embed.video`. A video sent before answers `already_exists` with its job, which we reuse. Media takes the post's one embed, so posts with media get no link card.
- **Link safety:** the URLs come from users, so `link-preview/safe-fetch.ts` only connects to public IPs. Each resolved address is checked inside the connection's own DNS lookup, so DNS rebinding can't get past it. It also only allows ports 80/443, re-validates every redirect, and caps size and time.
- **Errors:** XRPC errors map to our retry and "needs reconnect" logic. `@atproto/lex` and `lex-password-session` ship separate error classes, so they're matched by shape, not `instanceof`.

### Telegram

Built on the [Bot API](https://core.telegram.org/bots/api) (10.5).

- **Posting:** text goes out with `sendMessage` (up to 4,096 characters). Photos and videos are read from `MEDIA_PUBLIC_BASE_URL` and uploaded as multipart, because Telegram takes less by URL (5 MB photos, 20 MB files): one photo with `sendPhoto`, 2 to 10 as an album with `sendMediaGroup` (`attach://photo<n>`, the caption on the first), a video with `sendVideo` plus its width, height, length and `supports_streaming`. Photos are JPEG, PNG or WebP up to 10 MB, width + height at most 10,000 and no more than 20 times wider than tall (or the reverse); videos are MP4 up to 50 MB. With media, the text is a caption and limited to 1,024 characters. The post links to the first message.

### Discord

Built on [Execute Webhook](https://discord.com/developers/docs/resources/webhook#execute-webhook) with `?wait=true`, so the message comes back for its link and reactions.

- **Posting:** text is sent as JSON (up to 2,000 characters, mentions disabled). With media, the files are read from `MEDIA_PUBLIC_BASE_URL` and attached in one multipart request: `payload_json` describes them and each goes up as `files[n]` ([uploading files](https://discord.com/developers/docs/reference#uploading-files)). Up to 10 files and 25 MB per message, so photos (JPEG, PNG, GIF, WebP) are kept to 2.4 MB each and the video (MP4) to 20 MB, at most 1920×1080.

### Mastodon

Built on the [Mastodon REST API](https://docs.joinmastodon.org/methods/statuses/).

- **Posting:** `POST /api/v1/statuses` with an `Idempotency-Key` (Mastodon drops repeats for an hour). Photos and videos go up first with `POST /api/v2/media` (multipart `file`), which needs the token's `write:media` scope; tokens made before media support lack it, and the upload's 403 asks people to create a new token. A 202 means the server is still processing (typical for video), so we poll `GET /api/v1/media/:id` (206 processing, 200 ready, 422 failed, up to 4 minutes) and then post with `media_ids`.
- **Limits:** the static spec is Mastodon's default (photos 16 MB and 33,177,600 px; video MP4, WebM or MOV, 99 MB, 8,294,400 px, 120 fps; 4 attachments). Each server can set its own, so before uploading we read `GET /api/v2/instance` and stop with a plain message when a file is over that server's limit.

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
- More OAuth platforms: Meta, X, LinkedIn and YouTube.
