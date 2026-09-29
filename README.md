# Cricket Match Finder

One feed for every cricket match: where it is officially streamed, a deep link into that app, and a live scorecard.

Full setup guide arrives in Step 8. For now:

```bash
pnpm install
cp .env.example .env
pnpm --filter @cmf/shared build
pnpm dev:api      # http://localhost:3000/v1/health
pnpm dev:admin    # http://localhost:5173
pnpm dev:web      # http://localhost:5174  (fan website)
pnpm dev:mobile   # Expo dev server
pnpm test
```

Layout: `apps/api` (NestJS), `apps/web` (fan website, React + Vite), `apps/admin` (React + Vite), `apps/mobile` (Expo), `packages/shared` (shared types and cricket helpers).

## Database (Step 2)

Schema: `apps/api/prisma/schema.prisma`. Sample seed data: `apps/api/prisma/seed-data.ts`.

First-time setup (needs Docker running):

```bash
pnpm db:up                           # start Postgres + Redis
pnpm db:migrate -- --name init       # creates prisma/migrations/<timestamp>_init and applies it
pnpm db:seed                         # 2 tournaments, 8 teams, 10 matches (2 live), 4 broadcasters, IN rights
git add apps/api/prisma/migrations && git commit -m "Add initial migration"
```

Other commands: `pnpm db:studio` (browse data), `pnpm db:reset` (drop, re-migrate, re-seed).

The seed uses dates relative to when it runs, so re-run `pnpm db:seed` whenever you want the two live matches to be live again.
All seeded tournaments, scores and broadcast rights are **sample data**, and the broadcaster links are placeholders to verify before launch.

## Data provider and background jobs (Step 3)

All cricket data comes through `CricketDataProvider` (`apps/api/src/provider/cricket-provider.interface.ts`).
`CRICKET_PROVIDER=mock` (the default) uses a built-in mock that simulates live T20 matches ball by ball,
so the whole app works without an API key.

| Job | When | What it does |
| --- | --- | --- |
| Fixture sync | On startup and every 6 hours | Pulls fixtures from 7 days ago to 30 days ahead; upserts teams, venues, tournaments and matches by provider id. Never moves a match backwards (e.g. completed → live). |
| Live poller | Every `LIVE_POLL_MS` (15 s) | For live matches, and upcoming ones past their start time: fetches the scorecard, saves `live_scores`, updates the match status/toss/result, and publishes to Redis (`cmf:live` channel, `cmf:live:<matchId>` cache). |

Set `JOBS_ENABLED=false` to run an API instance without jobs.

## API v1 (Step 4)

Base URL `http://localhost:3000/v1`. Optional headers: `X-Region` (2-letter country, default `IN`) and
`X-Timezone` (IANA, default `Asia/Kolkata`). Invalid input returns `400` with a list of messages; unknown fields are rejected.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/matches` | Query: `status` (upcoming/live/completed/abandoned), `tournament`, `team` (UUIDs), `date` (YYYY-MM-DD in `X-Timezone`), `page` (default 1), `pageSize` (1–100, default 20). Results are newest first; everything else soonest first. |
| GET | `/matches/:id` | Match + live scorecard + `watchOptions` for `X-Region`, ordered: your subscriptions, then free, then A–Z. |
| GET | `/matches/:id/live` | Server-Sent Events: `score` event with the current scorecard, then one per update; `ping` every 25 s; closes after the result. |
| GET | `/tournaments` | Current and upcoming (`?all=true` for all), with `matchCount` and `liveCount`. |
| GET | `/tournaments/:id` | Tournament + points table (win 2, tie/no result 1, sorted by points then net run rate). Fixtures and results: `/matches?tournament=:id`. |
| GET | `/broadcasters` | Active broadcasters for the "My subscriptions" picker. |
| GET | `/teams` | All teams A–Z (favourite-team picker). |

Broadcast rights: a right set for a specific match **replaces** the tournament-level rights for that match in that region.
Rights apply when the match start time falls inside `valid_from`–`valid_to`.

Try it: `curl -N http://localhost:3000/v1/matches?status=live` then `curl -N http://localhost:3000/v1/matches/<id>/live`.

Auth (`/auth/*`) and `/me/*` come in Step 7.

## Admin panel (Step 5)

1. Set `ADMIN_API_KEY` in `.env` (e.g. `openssl rand -hex 24`) and restart the API. With no key set, the admin API returns 503.
2. `pnpm dev:admin` and open http://localhost:5173, then enter the key. It's kept only for the browser tab (session storage).

| Tab | What you can do |
| --- | --- |
| Broadcasters | Add/edit name, type, web link, app deep link, logo, affiliate URL. Deactivate to hide; delete only when a broadcaster has no rights. |
| Rights | Add who shows a tournament per country and language, for the whole tournament or one match (a single-match right replaces the tournament's rights for that match). Dates default to the tournament's dates. |
| Gaps | Upcoming/live matches in the next 7/14/30 days with no way to watch in a country. The API also logs these daily at 09:00 IST. |

Admin API (`X-Admin-Key` header required): `GET/POST /admin/broadcasters`, `PATCH/DELETE /admin/broadcasters/:id`,
`GET/POST /admin/rights`, `PATCH/DELETE /admin/rights/:id`, `GET /admin/rights/gaps?days=14&region=IN`.
Link templates may use `{matchId}` and `{providerMatchId}`; web links must be https.

The admin key is a stopgap: Step 7 replaces it with sign-in for users whose role is ADMIN.

## Mobile app (Step 6)

```bash
pnpm dev:mobile            # then press a (Android), i (iOS) or scan the QR code with Expo Go
```

Point the app at your API with `EXPO_PUBLIC_API_URL` (the default `http://localhost:3000/v1` only works in a simulator on the same machine):

| Where the app runs | EXPO_PUBLIC_API_URL |
| --- | --- |
| iOS simulator | `http://localhost:3000/v1` |
| Android emulator | `http://10.0.2.2:3000/v1` |
| Your phone (same Wi-Fi) | `http://<your computer's LAN IP>:3000/v1` |

Example: `EXPO_PUBLIC_API_URL=http://192.168.1.20:3000/v1 pnpm dev:mobile`. Also works in a browser: `pnpm --filter @cmf/mobile exec expo start --web`.

Screens: onboarding (country, subscriptions, favourite teams; skippable) → Matches (Live / Upcoming / Results, filter by favourite team or tournament) →
match detail (live scorecard over SSE, chase equation, batters at the crease, last 6 balls, commentary) → Watch on (official options for your country,
your subscriptions first; opens the broadcaster's app or falls back to its website) · Tournaments → tournament page (fixtures, points table, results) · Profile.

Preferences live on the phone (AsyncStorage) until sign-in arrives in Step 7. Times use the phone's time zone (Asia/Kolkata if unknown).
Deep link `cmf://match/<id>` opens a match (used by push alerts in Step 7).

## Fan website (`apps/web`)

`pnpm dev:web` → http://localhost:5174 (proxies `/v1` to the API on port 3000). Build with `pnpm --filter @cmf/web build`;
set `VITE_API_URL` if the API lives on another origin.

| Page | What's on it |
| --- | --- |
| `/` | Live now (cards, refresh every 30 s), Coming up (grouped by day), Recent results; filter by tournament |
| `/match/:id` | Scoreboard with chase and run rate, Where to watch (your subscriptions first, links open the broadcaster in a new tab), at the crease, last 6 balls, scorecard per innings, commentary; live updates over SSE |
| `/tournaments`, `/tournaments/:id` | Current series; fixtures, points table, results |
| `/preferences` | Country and the apps you pay for (saved in the browser) |

Clean, minimal design with automatic dark mode, keyboard-friendly (skip link, focus rings), respects reduced motion, and works from phone to desktop.
Score helpers (score text, chase, run rate, watch-option ordering) live in `packages/shared` and are used by both the website and the mobile app.

## Live demo (GitHub Pages)

The website is published at **https://abhi23raj472.github.io/cricket-match-finder/** in demo mode: GitHub Pages only serves
static files, so the demo runs the API's mock match simulation in the browser (one ball every 5 s) instead of calling a server.
Everything on it is sample data, and a banner says so.

- `.github/workflows/pages.yml` rebuilds and publishes it to the `gh-pages` branch on every push to `main` that touches the website.
- Build it yourself: `pnpm --filter @cmf/web build:pages` (sets `VITE_DEMO=true` and the `/cricket-match-finder/` base path).
- To show real data instead, host the API (e.g. Render, Railway, Fly.io with Postgres and Redis) and build without `VITE_DEMO`, with `VITE_API_URL=https://<your-api>/v1`.
