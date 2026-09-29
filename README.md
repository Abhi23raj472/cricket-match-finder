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
