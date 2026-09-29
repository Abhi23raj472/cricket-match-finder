# Cricket Match Finder

One feed for every cricket match: where it is officially streamed, a deep link into that app, and a live scorecard.

Full setup guide arrives in Step 8. For now:

```bash
pnpm install
cp .env.example .env
pnpm --filter @cmf/shared build
pnpm dev:api      # http://localhost:3000/v1/health
pnpm dev:admin    # http://localhost:5173
pnpm dev:mobile   # Expo dev server
pnpm test
```

Layout: `apps/api` (NestJS), `apps/admin` (React + Vite), `apps/mobile` (Expo), `packages/shared` (shared TypeScript types).

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

Set `JOBS_ENABLED=false` to run an API instance without jobs. The SSE endpoint that streams these updates to apps comes in Step 4.
