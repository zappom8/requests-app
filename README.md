# Song Request App

Lochie's live song request app — replaces Lime DJ. Full spec is in [SPEC.md](./SPEC.md); the approved implementation plan (schema, architecture decisions, phased build order) is in [`.claude/plans/deep-wondering-starlight.md`](/Users/lochlindormer/.claude/plans/deep-wondering-starlight.md).

## Status

**Phases 1–6 complete** (of 9 phases — see the plan doc for the full list):

- Prisma schema migrated; `pg_trgm` extension, trigram search indexes, and a partial index that keeps the Live Queue fast regardless of history size.
- Song Databases: create + manually add songs + mark one active.
- Public `/request`: browse (Songs / Artists / Decades) + fuzzy search + select + name/shout-out + optional tip ($2/$5/$10/$20/Other) via an embedded Stripe Payment Element (card/Apple Pay/Google Pay).
- Public `/queue`: truly live via Supabase Realtime Broadcast (a "queue changed" ping is sent after every mutation; clients refetch through `/api/queue`, which only ever returns public-safe fields — song/artist only, never tip amounts). A 30s poll remains as a fallback in case a broadcast is ever missed.
- Tip flow matches the locked design exactly: the request enters the queue immediately in untipped position; a PaymentIntent is created and linked; only Stripe's webhook confirming payment (`payment_intent.succeeded`) sets the real tip amount, which re-sorts the request to the front on next read. An abandoned/failed payment never blocks or removes the request. Verified end-to-end, including the known fee-timing edge case (Stripe's processing fee isn't available the instant payment succeeds — a `charge.updated` handler backfills it once it is).

- Dashboard is now behind a real login (`/dashboard/login`, Supabase Auth, email+password) — `src/proxy.ts` (Next 16's renamed `middleware.ts`) redirects any unauthenticated request to `/dashboard/*` pages or `/api/dashboard/*` endpoints. A single admin account exists for lochiedormer@hotmail.com. First-time setup goes through `/auth/confirm` (reads the session Supabase's recovery email delivers as a URL *fragment* — `#access_token=...` — client-side only, since fragments never reach a server) → `/dashboard/set-password`. Verified end-to-end with a real Supabase-issued token. A fresh reset-password email is still owed to Lochie once Supabase's auth email rate limit clears (hit it during testing) — see "Still needed" below.
- Live Queue (`/dashboard/queue`) shows full data per request — song, artist, requester, shout-out, tip, time — with large PLAYED/DELETE buttons. Both are soft actions (status change + timestamp, row never deleted) and both broadcast the same Realtime "queue changed" ping used elsewhere, so the public `/queue` and the dashboard stay in sync instantly. Verified end-to-end including a real hydration bug catch (locale/timezone-dependent time formatting rendering differently between server and browser — fixed with `suppressHydrationWarning` on just that element, the standard fix for this exact class of mismatch).
- Song Databases: duplicate / rename / delete (delete is only offered when a database is inactive and has no request history — `Request.songDatabaseId` is a restrict-on-delete FK specifically to protect permanent history). Song Manager: edit songs in place, CSV import (replace semantics — the upload becomes the database's entire song list) and CSV export, both via [papaparse](https://www.papaparse.com/) so quoted fields with commas (e.g. artist `"Earth, Wind & Fire"`) round-trip correctly — verified directly.
- Request History (`/dashboard/history`): every request ever made, any status, filterable by song/artist/status/database/date range/tip, with cursor-based pagination (not offset — stays fast regardless of table size). Actually load-tested: bulk-generated 50,000 synthetic historical rows via raw SQL, confirmed the Live Queue query stays sub-2ms and History's default sort/filtered search both stay sub-2ms too, then cleaned the synthetic data back out. One honest finding from that test: Postgres's query planner sometimes prefers the existing `songDatabaseId+status` composite index over the dedicated partial `live_queue_idx` for this query shape — both are fast in practice (the partial index's real advantage is staying small/cheap to maintain as PLAYED/DELETED history grows into the hundreds of thousands, not raw query speed at this scale).
- Tips & Payments (`/dashboard/payments`): gross/fee/refunded/net rollups, per-transaction table, date-range filter, CSV export, and a refund button (two-step confirm). Refunds are financial-only, exactly per the locked design — verified with a real Stripe test refund end-to-end: confirmed a real tip, refunded it via the dashboard, confirmed the refund actually exists on Stripe's side (not just our DB), and confirmed the request's queue `status` and position were completely untouched (net correctly goes negative on a refund, since Stripe doesn't return its processing fee).

A Supabase project ("Requests Project") and a Stripe account (test mode) are both connected — credentials in `.env`/`.env.supabase` (gitignored). Local dev's actual song/request data still lives on local Postgres; only the Realtime pub/sub layer (and now Auth) talks to Supabase in dev, so day-to-day testing doesn't touch the real Supabase project's (currently empty) database.

Not yet built: Statistics, Search Analytics, QR code, Profile/Settings.

## Running locally

Requires Node 20.9+ and a local Postgres. This machine has both set up already via Homebrew:

```bash
brew services start postgresql@16   # if not already running
npm install
npm run dev
```

Then open `http://localhost:3000/request` (public) and `http://localhost:3000/dashboard/queue` (admin — needs the login set up per Lochie's invite email, see Status above).

To seed sample data (a "General Requests" database with 10 songs, set active):

```bash
npx tsx prisma/seed.ts
```

## Database

- **Local dev**: plain Postgres, no pooling needed. `.env` points at `postgresql://lochlindormer@localhost:5432/song_request_dev`.
- **Production (planned)**: Supabase Postgres. `DATABASE_URL` = pooled connection (port 6543) for the running app; `DIRECT_URL` = direct connection (port 5432), used only by `prisma.config.ts` for migrations. See `.env.example`.
- Schema lives in [`prisma/schema.prisma`](./prisma/schema.prisma). This project uses **Prisma 7**, a much newer major version than most existing docs/tutorials assume — notably: driver adapters are mandatory (`@prisma/adapter-pg`, wired in [`src/lib/prisma.ts`](./src/lib/prisma.ts)), the generated client lives in `src/generated/prisma` (gitignored, regenerate with `npx prisma generate`), and Postgres extensions/typed indexes are no longer declarable in `schema.prisma` — they're hand-written directly into the migration SQL instead (see the bottom of [`prisma/migrations/20260807010226_init/migration.sql`](./prisma/migrations/20260807010226_init/migration.sql)). **Because of that last point: always inspect a newly generated migration before applying it** — `prisma migrate dev` doesn't know about those hand-written indexes and could propose dropping them.
- To change the schema: edit `schema.prisma`, run `npx prisma migrate dev --create-only --name <name>`, review/edit the generated SQL, then `npx prisma migrate dev` to apply.

## Testing the tip flow locally

Stripe webhooks need a way to reach your local machine — the Stripe CLI handles this. It's already installed (`brew install stripe/stripe-cli/stripe`). To start it fresh in a new terminal session:

```bash
stripe listen --api-key <STRIPE_SECRET_KEY from .env> --forward-to localhost:3000/api/webhooks/stripe
```

It'll print a `whsec_...` signing secret — put that in `.env` as `STRIPE_WEBHOOK_SECRET` (already done for the current key; only needed again if the CLI session changes). Leave it running in the background while testing.

For the card form itself: Stripe's Payment Element renders inside a sandboxed cross-origin iframe (by design, for PCI compliance) — genuinely typing into it needs a real browser, not an automated one. To test the full flow including a real card, use Stripe's standard test card `4242 4242 4242 4242`, any future expiry, any CVC. To test just the server-side flow (webhook handling, fee capture, queue re-sorting) without a browser, confirm a pending PaymentIntent directly:

```bash
curl https://api.stripe.com/v1/payment_intents/<pi_...>/confirm \
  -u <STRIPE_SECRET_KEY>: \
  -d payment_method=pm_card_visa \
  -d return_url=http://localhost:3000/queue
```

## Still needed from Lochie

- ~~A Supabase account/project~~ — done, connected.
- ~~Stripe test mode keys~~ — done, connected and verified.
- **One more password-setup email**, once Supabase's auth email rate limit clears (hit it while testing the fix above — should clear on its own, typically well under an hour). The underlying bug is fixed and verified with a real token; the next email sent will work.

## Deploying

Planned: Vercel, connected to the Supabase Postgres above. Not deployed yet — will confirm with Lochie before the first deploy.
