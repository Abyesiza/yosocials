# Yo Socials API

NestJS backend that connects social accounts, plans content with Gemini, publishes on schedule, and tracks how each post performs.

## Run it

```bash
cp .env.example .env        # then fill in DATABASE_URL, CREDENTIALS_ENCRYPTION_KEY, GEMINI_API_KEY
npm install
npm run start:dev           # http://localhost:4000/api, docs at /api/docs
```

Migrations run automatically on start (`DATABASE_RUN_MIGRATIONS=true`).

No Postgres yet? `npm run db:local` starts an in-memory one on port 5433. Point `DATABASE_URL` at `postgres://postgres:postgres@127.0.0.1:5433/postgres`. Its data is lost when it stops.

## Layout

```
src/
  config/            env validation (the app won't boot with bad config)
  database/          TypeORM options, entity list, migrations
  common/            base entity, AES-GCM credential encryption, typed HTTP client
  modules/
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

- **SocialAccount**: one connected account or channel. Holds the persona, brand voice and encrypted credentials.
- **Post**: one piece of content (`title`, `body`).
- **PostTarget**: that post on one account. It has its own text, `scheduledAt`, status, publish result and latest metrics. The feed and the calendar both read from this table.
- **PostMetricSnapshot**: engagement for a target at one point in time, so you can see how a post moved after publishing.

Target lifecycle: `draft → scheduled → publishing → published | failed`. Agent output always lands as `draft`. Nothing publishes until someone calls `POST /posts/:id/schedule` or `POST /posts/:id/publish`.

## Platforms

| Platform | Credentials | Metrics |
| --- | --- | --- |
| Bluesky | handle + app password | likes, reposts, replies, quotes |
| Mastodon | instance URL + access token (`read:accounts read:statuses write:statuses`) | favourites, boosts, replies |
| Telegram | bot token + channel; the bot must be an admin that can post | none (the Bot API can't read view counts) |
| Discord | channel webhook URL | reaction count |

To add a platform: add it to `common/enums/platform.enum.ts`, implement `PlatformProvider` in `modules/integrations/providers/<name>/`, and register it in `integrations.module.ts` and `integrations.registry.ts`. Then run `npm run migration:generate src/database/migrations/Add<Name>` to update the enum, and add the migration to `database/migrations/index.ts`.

## Scripts

| Script | What it does |
| --- | --- |
| `npm test` | unit tests (providers, facets, crypto, status logic) |
| `npm run test:e2e` | full flow against in-memory Postgres with stubbed platforms and a fake model |
| `npm run migration:generate src/database/migrations/<Name>` | diff entities against the DB |
| `npm run migration:run` / `migration:revert` | apply / undo |

## Not built yet

- Auth and workspaces. Every endpoint is open, so don't expose this API publicly yet.
- Media uploads (images and video).
- OAuth platforms: Meta, X, LinkedIn, TikTok and YouTube.
