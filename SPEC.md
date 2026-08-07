# Song Request Web App — Specification

A single-tenant (one artist: Lochie) live song request app that replaces Lime DJ.
Mobile-first, dark mode by default, fast, minimal-tap UX for both audience and artist.

## Architecture Decisions (locked in)

- **Stack**: Next.js (App Router) + TypeScript, PostgreSQL + Prisma ORM.
- **Hosting**: Vercel (app) + Neon or Supabase (Postgres, includes built-in connection pooling — required for serverless).
- **Payments**: Stripe, **standard single account** (no Stripe Connect — this is not a multi-seller platform). Direct charges to the artist's own Stripe account. Currency: **AUD**.
- **Search**: Postgres full-text search + `pg_trgm` (trigram) for typo tolerance. No external search service (Elasticsearch/Algolia) needed at this scale.
- **Auth**: Single admin credential (not multi-user auth). Magic link or passkey for the dashboard login.
- **Real-time**: Live Queue (dashboard) and public Queue view update live during a set — WebSockets or SSE (not just polling) so new requests / played / deleted reflect instantly.
- **Multi-tenancy**: None. Single-artist only, no plan to license to other musicians — schema does not need a tenant/artist ID.

## Product Decisions (locked in)

- **Queue ordering**: Untipped requests ordered strictly by request time — no time-decay boost, no cap on how far tips can push them back. Tips can starve untipped requests indefinitely; that's intentional (more tips = good).
- **Payment race handling**: A request enters the queue immediately in untipped position upon submission. When the Stripe webhook confirms payment, the request is re-sorted into tipped priority. If payment is abandoned, the request simply stays in its untipped position — never lost.
- **Show concept**: None. The request page and tip payments are live 24/7, with no "start/end show" gating.
- **Spam/abuse**: No rate limiting on requests — audience can submit as many as they want; artist deletes unwanted ones from the Live Queue manually.
- **Word filter**: Not included in v1 (Lime DJ has this; not used, so skipped). Can be added later if needed.
- **Refunds**: Refunding a tip does not need to affect queue position/status — it's a financial-only action, decoupled from the queue.

## Core Feature Spec

[Full feature spec as originally provided — public request page, artist dashboard, song databases, song manager, request history, tips & payments, statistics, search analytics, QR code, settings — see conversation history / to be expanded into individual spec docs per section as build proceeds.]

### Public Request Page (`/request` — permanent URL, permanent QR code)
- Header, search bar, browse by Songs / Artists / Decades.
- Song select → name + optional shout-out + optional tip ($2/$5/$10/$20/Other via Stripe: Apple Pay, Google Pay, card).
- Public queue view (song + artist only, no tip amounts shown).
- Confirmation screen → View Queue / Follow Lochie (profile page: photo, bio, social links, editable from dashboard).

### Artist Dashboard (single-admin login)
- **Live Queue**: large-button, minimal UI. Song/artist/requester/shout-out/tip/time. PLAYED and DELETE actions (soft — never hard-deletes, just changes status and removes from active queue).
- **Song Databases**: multiple reusable databases (General Requests, Wedding, Acoustic, Christmas, etc). Create/duplicate/rename/delete, CSV import/export, select active database (changes what `/request` shows immediately, no URL/QR change).
- **Song Manager**: add/edit/delete songs, bulk CSV import/export. CSV format: `Song Name,Artist,Decade`.
- **Request History**: permanent record of every request (song, artist, requester, shout-out, tip, Stripe payment ID, time, status, database used). Searchable/filterable. Paginated — must scale to hundreds of thousands of rows without slowing the Live Queue (Live Queue only ever reads *queued* rows).
- **Tips & Payments**: total/net tips, Stripe fees, per-transaction detail, refund action, CSV export.
- **Statistics**: totals, most requested/profitable songs & artists, decades, databases, top-tipping songs, requests/tips per month, requests by day-of-week/hour, date-range filtering.
- **Search Analytics**: log a search on submit / result selection / debounce-after-typing-stops (never per-keystroke). Track term, time, whether results were found, database. Surfaces most-searched songs/artists and unsuccessful searches.
- **QR Code**: permanent QR pointing at `/request`, download PNG/SVG.
- **Profile / Settings**: social links, default tip amounts, queue behaviour, brand colours, logo.

## Future Extensibility (not built now, don't block on it)
Architecture should not preclude later adding: audience voting, favourites, setlists, venue analytics, AI-powered repertoire suggestions.
