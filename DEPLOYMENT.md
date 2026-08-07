# Deployment Checklist

This started as the checklist for the app's first deploy (steps 1, 2, 4, 6, 7 — already done, the app is live). It now doubles as the reference for the Stripe→Square payment migration, which reuses steps 3, 5, 8, and 9 with Square's env vars/webhook/keys instead of Stripe's. Two things here are genuinely irreversible-ish (switching a payment provider to live/production keys, making the app publicly reachable with real payment processing), so this doc exists to walk through deliberately rather than as a one-command script. Confirm with Lochie before executing the live-payments step specifically.

Deploying also permanently fixed the "localhost isn't reachable from your phone" problem that caused the login-link friction earlier — once there's a real URL, email links work from any device.

## 1. Push the code somewhere Vercel can see it

```bash
# from the project root — create a GitHub repo first, then:
git remote add origin <your-github-repo-url>
git push -u origin main
```

## 2. Create the Vercel project

- Import the GitHub repo at vercel.com/new
- Framework preset: Next.js (auto-detected)
- Don't deploy yet — set environment variables first (next step), or the first deploy will fail on missing `DATABASE_URL` etc.

## 3. Environment variables (Vercel project settings → Environment Variables)

Copy from `.env` / `.env.supabase`, with two changes:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Supabase **pooled** connection (port 6543, `?pgbouncer=true`) — from `.env.supabase` |
| `DIRECT_URL` | Supabase **direct** connection (port 5432) — from `.env.supabase` |
| `NEXT_PUBLIC_SUPABASE_URL` | same as local |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | same as local |
| `SUPABASE_SECRET_KEY` | same as local |
| `SQUARE_ACCESS_TOKEN` | **Sandbox token to start** — switch to a production token only when ready, see step 9 |
| `SQUARE_ENVIRONMENT` | `sandbox` to start — same |
| `NEXT_PUBLIC_SQUARE_APPLICATION_ID` | Sandbox Application ID to start |
| `NEXT_PUBLIC_SQUARE_LOCATION_ID` | Sandbox Location ID to start |
| `NEXT_PUBLIC_SQUARE_ENVIRONMENT` | `sandbox` to start — client needs its own copy to pick the right CDN script |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | **new value** — see step 5, this is a Sandbox signing key, separate from production's |
| `NEXT_PUBLIC_APP_URL` | the real Vercel URL (e.g. `https://your-app.vercel.app`), or custom domain once one exists |

For the Stripe→Square migration specifically: add these on the **Preview** environment scope first (so the migration branch's Vercel Preview deployment can be tested without touching live `main`), then copy them to **Production** scope once merged.

## 4. Apply the database schema to Supabase

Already done once during development (verified in an earlier session — Supabase's schema already matches `prisma/migrations`). If any migrations have landed since, apply them:

```bash
DATABASE_URL="<supabase direct url>" npx prisma migrate deploy
```

(Uses the direct, non-pooled connection — pooled connections can't run migrations reliably.)

## 5. Set up the Square webhook subscription

The core payment flow doesn't need a webhook at all (Square's `CreatePayment` confirms synchronously) — this webhook exists purely for the fee-backfill/refund-reconciliation safety net:

1. Square Developer Dashboard → your app → **Webhooks** → **Add Subscription**
2. URL: `https://<your-domain>/api/webhooks/square`
3. Events to send: `payment.updated`, `refund.updated`
4. Copy the resulting **Signature Key** into Vercel's `SQUARE_WEBHOOK_SIGNATURE_KEY`
5. Sandbox and Production are separate subscriptions in Square (same relationship as Stripe test/live) — repeat this for a production subscription in step 9, don't reuse the Sandbox one.

## 6. Supabase Auth: allow the production URL

Supabase Auth only redirects to allow-listed URLs. In the Supabase dashboard: **Authentication → URL Configuration**, add the production domain (e.g. `https://your-app.vercel.app/**`) to the allowed redirect URLs — otherwise login/password-reset links will fail in production the same way `localhost` failed for a different device.

## 7. Deploy

Trigger the Vercel deploy (push to `main`, or click Deploy in the dashboard). Check the build logs — the Prisma client generates automatically via `postinstall` in most setups; if it doesn't, add `"postinstall": "prisma generate"` to `package.json` scripts.

## 8. Smoke test in production

- [ ] `/request` loads, search works, a no-tip request submits and shows on `/queue`
- [ ] A tip completes with a Square Sandbox test card (`4800 0000 0000 0004`, CVV `111`, any future expiry, any postal code) and the request re-sorts to the front of the queue
- [ ] Processing fee backfills on the Tips & Payments dashboard within a few seconds (confirms the webhook fired — check Square Developer Dashboard → Webhooks → your subscription → recent deliveries)
- [ ] Dashboard login works from a phone (the actual point of deploying)
- [ ] QR code (`/dashboard/qr`) downloads and scans to the correct production URL

## 9. Going live with real payments (separate decision — confirm explicitly before doing this)

Only when Lochie is actually ready to take real tips:

1. Square Developer Dashboard → switch out of Sandbox → get production Access Token / Application ID / Location ID
2. Update Vercel env vars `SQUARE_ACCESS_TOKEN`, `NEXT_PUBLIC_SQUARE_APPLICATION_ID`, `NEXT_PUBLIC_SQUARE_LOCATION_ID` to the production values, and set `SQUARE_ENVIRONMENT` / `NEXT_PUBLIC_SQUARE_ENVIRONMENT` to `production`
3. Repeat step 5 for a **production** webhook subscription (Sandbox and production are separate in Square) — update `SQUARE_WEBHOOK_SIGNATURE_KEY` to the production one
4. If Apple Pay is in scope: verify the domain in Square Dashboard → your app → Apple Pay → Web domains (upload the domain-verification file it provides)
5. Redeploy (env var changes need a redeploy to take effect)
6. Do one real, tiny test tip to confirm money actually moves correctly before telling anyone the QR code is live — including confirming the processing fee lands correctly on the Tips & Payments dashboard
