# Posting research: times, limits, media and trends

Researched 2026-11-28 from official documentation and the main industry studies. The numbers in each provider's `capabilities.posting` and `capabilities.media` come from here. Update this file when a platform changes its rules.

## How to read the timing studies

- Sprout Social, Buffer and Hootsuite report times **in the audience's local time**, so “9:00” means 9:00 where the viewers are. Later's TikTok “brand” window is the exception (US Eastern).
- None of the studies is African, and none says how many African accounts it includes. There is **no published hour-by-hour usage data for Uganda, Kenya, Tanzania, Rwanda, Nigeria, Ghana or South Africa** (DataReportal, Reuters Institute, GeoPoll and the vendors were checked).
- Treat the windows as starting points. Buffer 2026: posting consistently matters more than timing; timing is “an amplifier, not a primary driver”.

## Windows by platform (audience local time)

| Platform | Best (evidence) | Also good | Avoid | Frequency | Spacing (judgement) |
| --- | --- | --- | --- | --- | --- |
| X | Tue–Thu 08:00–11:00 (Buffer 2026, 8.7M posts; Hootsuite 2025) | Mon–Thu 12:00–17:00 (Sprout 2026, 2B engagements) | Sat; 22:00–07:00 | 1–3 a day (Hootsuite 2–3) | 2 h |
| LinkedIn | Tue–Thu 11:00–17:00 (Sprout 2026; Buffer 2026, 4.8M posts) | Wed–Fri 15:00–18:00 (Buffer) | Weekends (B2B); before 08:00; after 20:00 | 2–5 a week; Buffer's frequency study (2M+ posts) found more posts didn't hurt per-post reach | 18 h |
| TikTok | Every day 18:00–22:00 (Buffer 2026, 7.1M posts; Later 2026) | Sat–Sun 09:00–13:00 (Buffer); weekday 13:00–17:00 (Sprout, conflicting) | 00:00–07:00 | 3–7 a week (Hootsuite observed 3–5) | 3 h |
| Bluesky | Weekdays 18:00–21:00, weekends 17:00–21:00 (Buffer 2026, 3M+ posts; SocialPilot) | Weekday 09:00–11:00 (SocialPilot only) | 00:00–07:00 | 1–3 a day | 2 h |
| Mastodon | No study. Feeds are chronological, so post while the audience is awake | | Night | Up to 3 a day | 90 min |
| Telegram | No study (TGStat/Telemetr unavailable). Every post notifies subscribers; send albums as one message | | 22:00–07:00 | 1–3 a day | 2 h |
| Discord | No study. Discord warns frequent pings make members mute or leave | | Before 09:00 | Announcements 1–3 a week | 24 h |

Sources: sproutsocial.com/insights/best-times-to-post-on-social-media, buffer.com/resources/best-time-to-post-social-media, buffer.com/resources/state-of-social-media-engagement, buffer.com/resources/best-time-to-post-on-{linkedin,tiktok,twitter-x,bluesky}, buffer.com/resources/how-often-to-post-on-linkedin, blog.hootsuite.com/best-time-to-post-on-social-media, blog.hootsuite.com/how-often-to-post-on-social-media, later.com/blog/best-time-to-post-on-social-media, socialpilot.co/blog/best-time-to-post-on-bluesky, business.linkedin.com/marketing-solutions/linkedin-pages/best-practices, telegram.org/faq_channels, discord.com/community/understanding-server-insights.

## African audiences

- Time zones: EAT UTC+3 (Uganda, Kenya, Tanzania), CAT UTC+2 (Rwanda), SAST UTC+2 (South Africa), WAT UTC+1 (Nigeria), GMT (Ghana). Windows are applied in the audience's zone, not the creator's.
- Reach (DataReportal Digital 2026, ad reach, Oct 2025): TikTok is the largest or joint-largest platform in Kenya (18.4M), Nigeria (47.8M) and South Africa (29.1M). LinkedIn: South Africa 17.0M, Nigeria 13.0M, Kenya 6.3M, Uganda 1.8M, Tanzania 1.7M. Nigerians use social media 5.84 days a week, the highest cited (GWI).
- Mobile data is cheap by global standards (Cable.co.uk 2023, 1GB: Nigeria $0.39, Ghana $0.40, Rwanda $0.55, Kenya $0.59, Tanzania $0.84, Uganda $1.11, South Africa $1.81). Night bundles exist (MTN Nigeria), but no data shows they shift engagement.
- Friday prayers and Sunday services are plausible effects but undocumented; they are not hard-coded.

Sources: datareportal.com/reports/digital-2026-{uganda,kenya,nigeria,south-africa,ghana,tanzania,rwanda}, datareportal.com/reports/digital-2026-global-overview-report, reutersinstitute.politics.ox.ac.uk/digital-news-report/2025/{nigeria,kenya}.

## Platform posting limits (documented)

| Platform | Limits | When exceeded |
| --- | --- | --- |
| X | 100 posts / 15 min per user; 10,000 / 24 h per app. Each post billed $0.015, $0.20 with a link | 429 code 88; `x-rate-limit-reset` |
| LinkedIn | Share on LinkedIn: 150 calls / day per member (uploads count), 100,000 per app; resets midnight UTC | 429, no retry header |
| TikTok | ~15 Direct Posts / day per creator, shared across apps (“typically”); 6 publish inits / minute; unaudited apps: 5 users / day, private only | 403 `spam_risk_too_many_posts`, 429 `rate_limit_exceeded` |
| Bluesky | 5,000 write points / hour, 35,000 / day (a post = 3); 30 logins / 5 min; video daily limits via `getUploadLimits` | 429 |
| Mastodon | 300 requests / 5 min; ~300 posts / 3 h; 30 uploads / 30 min (defaults; instances may differ) | 429, `X-RateLimit-Reset` |
| Telegram | ~1 message / s per chat, 20 / min per group or channel, 30 / s per bot | 429 with `retry_after` |
| Discord | Per-webhook buckets set at runtime; 50 requests / s global; 10,000 invalid requests / 10 min per IP bans | 429 with `retry_after` / `Retry-After` |

Sources: docs.x.com/x-api/fundamentals/rate-limits, docs.x.com/x-api/getting-started/pricing, learn.microsoft.com/en-us/linkedin/shared/api-guide/concepts/rate-limits, developers.tiktok.com/doc/tiktok-api-v2-rate-limit, developers.tiktok.com/doc/content-sharing-guidelines, github.com/bluesky-social/bsky-docs (advanced-guides/rate-limits), docs.joinmastodon.org/api/rate-limits, core.telegram.org/bots/faq, discord.com/developers/docs/topics/rate-limits.

## Trends

- **Used:** Google Trends “Trending now” RSS (`trends.google.com/trending/rss?geo=XX`; unofficial and undocumented; works for UG, KE, NG, ZA, GH, TZ; not RW), Mastodon trending tags (official, public, platform-wide), Bluesky trending topics (public, “unspecced” so unstable, platform-wide).
- **Off by choice:** X trends (official, $0.01 a lookup; no Uganda, Tanzania or Rwanda).
- **Off until a paid key:** Gemini Grounding with Google Search. Gemini 3 has no grounding on the free tier; paid includes 5,000 queries a month, then about $14 per 1,000; 1,500 a day per project by default. Google's terms: show Search Suggestions and sources unmodified, only to the person who asked; don't cache or share grounded results.
- **Not possible legitimately:** trending TikTok sounds (no API; scraping breaks TikTok's terms; the Research API is academic only). Business accounts may only use TikTok's Commercial Music Library, so the planner suggests formats and hashtags and points people to the library and Creative Center.

Sources: aistudio.google.com/docs/google-search, aistudio.google.com/docs/pricing, aistudio.google.com/docs/terms, docs.x.com/x-api/trends, docs.joinmastodon.org/methods/trends, ads.tiktok.com/help/article/commercial-music-library, developers.tiktok.com/products/research-api.

## Calendar library

FullCalendar v7 (MIT): month, week, day and list views, drag and drop, “+N more”, named time zones and React 19 support are all free; premium (timeline, resources, print) isn't needed. Alternatives: Schedule-X (drag and drop is paid), react-big-calendar (weaker accessibility and time zones), ilamy (good fit but single maintainer, DST bug), Toast UI (archived).
