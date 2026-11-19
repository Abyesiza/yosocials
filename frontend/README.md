# Yo Socials

Plan, publish and track posts across every platform in one place.

| Part | Where | Port |
| --- | --- | --- |
| Web app (Next.js 16) | `/` | 3000 |
| API (NestJS 12) | `api/`, see [api/README.md](api/README.md) | 4000 |

## Run it locally

```bash
# 1. API: needs api/.env (DATABASE_URL, CREDENTIALS_ENCRYPTION_KEY, JWT_SECRET, GEMINI_API_KEY)
cd api && npm install && npm run start:dev

# 2. Web app, in another terminal
npm install && npm run dev
```

Open http://localhost:3000 and sign up. If the API isn't on `http://localhost:4000`, set `API_URL` for the web app.

## How the web app talks to the API

The browser never holds API tokens. Requests go to the Next.js server under `/bff/...`:

- `app/bff/auth/[action]`: sign-in, sign-up and sign-out. These store the API's tokens in httpOnly cookies (`ys_at`, `ys_rt`).
- `app/bff/[...path]`: forwards to `<API_URL>/api/...` with the access token. When that token expires, it refreshes it once with the refresh cookie, retries, and stores the new pair.
- `proxy.ts`: sends signed-out visitors to `/signin`. This is routing only; the API checks permissions on every call.

Pages under `/w/[workspaceId]` are client components that fetch through `/bff` with SWR (`app/lib/api/client.ts`). Response types are in `app/lib/api/types.ts`, which mirrors the API's DTOs.

| Route | Page |
| --- | --- |
| `/signin`, `/signup` | auth |
| `/w/:id` | home feed: every published post, filterable by account |
| `/w/:id/calendar` | week view of drafts, scheduled and published posts |
| `/w/:id/create` | compose once, customize per platform, AI variants, post now, schedule or save a draft |
| `/w/:id/plan` | AI calendar planning into drafts, then approve |
| `/w/:id/posts/:postId` | per-platform status, edit, schedule/publish, engagement history |
| `/w/:id/analytics` | totals, per account, top posts |
| `/w/:id/accounts` | connect and check Bluesky, Mastodon, Telegram and Discord |
| `/w/:id/settings` | rename, members and roles, leave, delete |
| `/me`, `/workspaces/new` | profile and password, new workspace |
