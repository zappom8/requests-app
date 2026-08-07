# Deployment Checklist

This is a checklist for the actual first deploy — not something to run blindly. Two steps here are genuinely irreversible-ish (switching Stripe to live keys, making the app publicly reachable with real payment processing), so this doc exists to walk through deliberately rather than as a one-command script. Confirm with Lochie before executing the Stripe-live-mode step specifically.

Deploying also permanently fixes the "localhost isn't reachable from your phone" problem that caused the login-link friction earlier — once there's a real URL, email links work from any device.

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
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | **test key to start** — switch to live only when ready, see step 6 |
| `STRIPE_SECRET_KEY` | **test key to start** — same |
| `STRIPE_WEBHOOK_SECRET` | **new value** — see step 5, this is NOT the same secret used for local Stripe CLI testing |
| `NEXT_PUBLIC_APP_URL` | the real Vercel URL (e.g. `https://your-app.vercel.app`), or custom domain once one exists |

## 4. Apply the database schema to Supabase

Already done once during development (verified in an earlier session — Supabase's schema already matches `prisma/migrations`). If any migrations have landed since, apply them:

```bash
DATABASE_URL="<supabase direct url>" npx prisma migrate deploy
```

(Uses the direct, non-pooled connection — pooled connections can't run migrations reliably.)

## 5. Set up the real Stripe webhook endpoint

The local dev webhook secret (from `stripe listen`) only works for local testing — production needs its own:

1. Stripe Dashboard → Developers → Webhooks → **Add endpoint**
2. URL: `https://<your-domain>/api/webhooks/stripe`
3. Events to send: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.updated`
4. Copy the resulting **signing secret** into Vercel's `STRIPE_WEBHOOK_SECRET`

## 6. Supabase Auth: allow the production URL

Supabase Auth only redirects to allow-listed URLs. In the Supabase dashboard: **Authentication → URL Configuration**, add the production domain (e.g. `https://your-app.vercel.app/**`) to the allowed redirect URLs — otherwise login/password-reset links will fail in production the same way `localhost` failed for a different device.

## 7. Deploy

Trigger the Vercel deploy (push to `main`, or click Deploy in the dashboard). Check the build logs — the Prisma client generates automatically via `postinstall` in most setups; if it doesn't, add `"postinstall": "prisma generate"` to `package.json` scripts.

## 8. Smoke test in production

- [ ] `/request` loads, search works, a no-tip request submits and shows on `/queue`
- [ ] A tip completes with a real Stripe test card (`4242 4242 4242 4242`) and the webhook fires (check Stripe Dashboard → Webhooks → your endpoint → recent deliveries)
- [ ] Dashboard login works from a phone (the actual point of deploying)
- [ ] QR code (`/dashboard/qr`) downloads and scans to the correct production URL

## 9. Going live with real payments (separate decision — confirm explicitly before doing this)

Only when Lochie is actually ready to take real tips:

1. Stripe Dashboard → toggle out of Test mode → get live-mode `pk_live_...` / `sk_live_...` keys
2. Update Vercel env vars `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` and `STRIPE_SECRET_KEY` to the live keys
3. Repeat step 5 for a **live-mode** webhook endpoint (test and live mode webhooks are separate in Stripe) — update `STRIPE_WEBHOOK_SECRET` again
4. Redeploy (env var changes need a redeploy to take effect)
5. Do one real, tiny test tip to confirm money actually moves correctly before telling anyone the QR code is live
