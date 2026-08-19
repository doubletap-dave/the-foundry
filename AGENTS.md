# The Foundry

Type a spark on the console, The Foundry returns one take, then you build it, mutate, or discard. See `README.md` for the product overview.

## Cursor Cloud specific instructions

Single Next.js 15 app (App Router, React 19, TypeScript) backed by a local SQLite file at `data/foundry.db` (better-sqlite3 + drizzle-orm). There is one service: the dev server on port 3000.

### Standard commands

All commands are in `package.json` `scripts`:

- `npm run dev` — dev server on port 3000 (`next dev`). This is the service to run.
- `npm run lint` — ESLint (`next lint`). Passing state shows a single non-blocking `react-hooks/exhaustive-deps` warning in `src/components/looking.tsx`; that warning is pre-existing, not a regression.
- `npm run build` — production build (`next build`), useful to typecheck.
- `npm run db:setup` — `drizzle-kit push` (applies the full `src/db/schema.ts`) then seeds demo data (`src/db/seed.ts`). See DB note below.

### Database notes (non-obvious)

- `data/foundry.db` is git-ignored, so a fresh clone has no database file.
- The core console flow does not need a manual migration: `src/db/index.ts` creates the `sparks`, `provider_keys`, and `model_configs` tables at import time, so the app runs after `npm install` alone.
- `npm run db:setup` is only needed to create the legacy schema tables (`ideas`, `runs`, `experiments`, etc.) and to seed the demo "Tarkov run" used by the seed script. It is idempotent (safe to re-run).
- SQLite runs in WAL mode; expect `data/foundry.db-wal` / `-shm` sidecar files.

### Provider keys are required for the core feature (LLM calls)

Igniting a spark (spark → "take") calls a live LLM provider: OpenAI, Grok, OpenRouter, or Perplexity. There is no offline/mock mode; without a key, submitting a spark returns `No keys.`

Keys are NOT read from environment variables. They are supplied two ways:

1. Client-side (primary): pasted in the `/settings` page and stored in the browser's `localStorage`, then sent with each request.
2. Server-side fallback: rows in the `provider_keys` SQLite table (used when no request key is present). Insert one with `npx tsx -e` calling `upsertKey` from `src/lib/providers.ts`, or via `db:seed`-style code, to enable server-side runs (e.g. `scripts/ignite-once.ts`).

`scripts/ignite-once.ts` (`npx tsx scripts/ignite-once.ts "an idea"`) runs the ignite graph headlessly and requires a server-side (SQLite) key.

### Routing note

`/history` redirects (307) to `/` and `/models` redirects to `/settings` (see `src/app/history/page.tsx`, `src/app/models/page.tsx`); these redirects are expected, not broken routes. The main UI lives at `/` (the console) and `/settings`.
