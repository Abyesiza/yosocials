@AGENTS.md
@docs/engineering-standards.md

## Project notes

- Aby Socials: Next.js 16 web app at the repo root, NestJS 12 API in `api/` (it has its own `api/AGENTS.md`).
- `--primary` is the logo blue (#1777F2), darkened to `214 89% 45%` in light mode and lightened to `65%` with dark text in dark mode, so every text pair passes WCAG AA (checked by computing the ratios). The exact logo colors are `--brand-*` accents.
- Dashboards use full-width pages. Content fills the area beside the `w-64` sidebar; don't center it in a narrow column.
- After any entity change in `api/`, generate and review a migration, run the e2e tests, apply it to the real database, and confirm `migration:generate x --check` reports no changes.
