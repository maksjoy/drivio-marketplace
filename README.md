# Alberta-Cars

Alberta-Cars is an Alberta-only marketplace for private used-vehicle sales. The production application is a single **Next.js 15 + Supabase** web app deployed on Vercel. There is no second static `production/` frontend and no Telegram runtime in this repository.

TODO: the public domain is not purchased yet. Keep the current Vercel hostname and `support@p2pcars.ca` until a domain is bought and the mailbox is verified. Do not rename `NEXT_PUBLIC_SITE_URL` or hardcode a new canonical host before then. The fallback in `lib/site-url.ts` stays the existing Vercel URL.

## Production architecture

- Next.js App Router is the only web application.
- Supabase provides PostgreSQL, Auth and private Storage.
- Authentication is handled server-side with secure HttpOnly cookies; access/refresh tokens are not stored in browser localStorage.
- New and edited listings are `pending` until an administrator approves them.
- Listing photos are private Storage objects. The app already requests short-lived signed URLs. Two live-database migrations that restrict anonymous photo reads and hide `listings.user_id` from `anon` are committed and still waiting to be applied. See `ops/READINESS.md`.
- Vercel serves hashed `/_next/static/*` assets with immutable caching.
- CSP uses per-request nonces and does not require `script-src 'unsafe-inline'`.
- Sentry is connected on the Vercel deployment for browser and server errors.

## Marketplace rules and limits

- Private sellers only; dealer/commercial inventory is not allowed.
- Required listing fields: make, model, year, price, mileage, fuel and 1–8 photos.
- Seller contact is phone and/or email, stored privately and not shown on the public listing.
- Owners can mark a vehicle sold or remove it.
- Sold listings can remain visible for up to 14 days before cleanup.
- Owners cannot activate their own listing; activation is an admin action.
- Database triggers and RLS enforce ownership, moderation and abuse limits even for direct API requests.

## Local setup

1. Install Node.js **24.x**.
2. Run `npm ci`.
3. Copy `.env.example` to `.env.local` and configure the Supabase URL and publishable key.
4. Run `npm run dev`.

Useful checks:

```bash
npm run typecheck
npm run test:unit
npm run build
npm run test:security-live
npm run test:e2e
```

`npm run test:security-live` talks to the live Supabase project. Two tests stay red until the pending migrations in `ops/READINESS.md` are applied: anonymous `listings.user_id` reads, and anonymous listing-photo list or `/object/authenticated/` downloads. The other security-live tests should pass.

## CI

GitHub Actions workflow `Test Alberta-Cars Web` uses Node 24 and `npm ci`, typechecks, runs `npm run test:unit`, builds the Next.js app, runs the public security boundary tests, runs `tests/database-security.sql` when the `SUPABASE_DB_URL` repository secret is set, and runs Playwright plus a read-only load smoke. On `main` it also checks that the production catalog can be served from the Vercel CDN cache.

The CI source-tree guard fails if a legacy `production/` directory, a browser Supabase session client, or Telegram runtime references are reintroduced into `app`, `components`, `lib`, or `middleware.ts`.

## Database migrations

Update an existing database only from `supabase/migrations/`, in filename order. Apply each new file yourself with:

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --single-transaction -f path/to/migration.sql
```

`supabase/schema.sql` is an outdated sketch for a brand-new empty project. Do not apply it to the live database. It does not match production tables, policies, or grants.

Pending on the live database, from PR #18, in this order:

1. `supabase/migrations/20261023210000_signed_url_only_listing_photos.sql`
2. `supabase/migrations/20261023211000_hide_listing_owner_from_anon.sql` — only after the first file is applied and listing photos still load

Details, pre/post checks, and rollback are in those files and in `ops/READINESS.md`.

## Administration

The `/admin` route is owner/admin-only. Every admin mutation rechecks membership in the `admins` table on the server. Admin tools include listing approval/removal, reports, user moderation, aggregate analytics and recent activity.

Never place a Supabase service-role key, Sentry auth token, database URL, or other server credential in browser code or a `NEXT_PUBLIC_*` variable, except values explicitly designed to be public such as the Supabase publishable key and Sentry DSN.

## Auth CAPTCHA and rate limits

Sign-in, signup, and password recovery can show a Cloudflare Turnstile widget and send its token to Supabase Auth as `captchaToken`. Supabase checks that token only after CAPTCHA is enabled in the Supabase dashboard. Password updates from the reset page are rate limited, and they do not show a widget. Sign-out is not limited.

The widget is rendered only when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set. The server reads that value per request, so an empty value is not baked into the client bundle. Rate limiting uses `@upstash/ratelimit` and `@upstash/redis`. It runs only when both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set. Otherwise the server logs one warning and allows the attempt. A Redis error also allows the attempt, so an Upstash outage does not take down login.

Limits, per action:

| Action | Per client IP | Per normalized email |
| --- | --- | --- |
| Sign in | 20 / 15 minutes | 10 / 15 minutes |
| Signup | 5 / hour | 3 / hour |
| Password recovery | 5 / hour | 3 / hour |
| Password update | 10 / hour | — |

The client IP comes from Vercel's `x-real-ip`, then the first address in `x-vercel-forwarded-for`. `x-forwarded-for` is ignored. If neither trusted header is present, requests share an `unknown` bucket. Email is trimmed and lowercased. A value without `@` counts against the IP bucket only. A limited request returns 429 with `Retry-After` and `Too many attempts. Please try again later.` The response does not say which bucket fired.

Rollout order, so login never breaks:

1. Deploy this code with the three env vars unset. The widget stays hidden, limiting is skipped, and existing sign-in works.
2. Create a Cloudflare Turnstile widget. Keep the secret key for Supabase only. Do not add it to Vercel.
3. Create an Upstash Redis database and copy its REST URL and token.
4. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN` in Vercel, then redeploy.
5. Confirm the sign-in, signup, and recovery forms show the widget and that sign-in still succeeds. Supabase is not checking tokens yet.
6. In Supabase Auth, enable CAPTCHA, choose Cloudflare Turnstile, and paste the Turnstile secret. Do this only after step 5. Enabling it earlier rejects every sign-in because no token is sent.

CSP already allows `https://challenges.cloudflare.com` on `script-src`, `frame-src`, and `connect-src`. The widget script uses the per-request nonce.

## Deployment

Vercel builds the repository as Next.js using Node 24 and `npm ci`. The live site currently uses the Vercel hostname configured through `NEXT_PUBLIC_SITE_URL` (see the TODO above). It uses the existing Supabase project. Do not point production at a different project until the pending migrations and a restore drill are done.
