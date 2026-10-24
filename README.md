# Alberta-Cars

Alberta-Cars is an Alberta-only marketplace for private used-vehicle sales. The production application is a single **Next.js 15 + Supabase** web app deployed on Vercel. There is no second static `production/` frontend and no Telegram runtime in this repository.

TODO: the official public domain and support mailbox are not yet verified. Keep the current deployment URL configuration until an Alberta-Cars domain is configured and tested. Do not publish an unverified support address or hardcode a new canonical host before then.

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
npm run build
npm run test:security-live
npm run test:e2e
```

`npm run test:security-live` talks to the live Supabase project. Two tests stay red until the pending migrations in `ops/READINESS.md` are applied: anonymous `listings.user_id` reads, and anonymous listing-photo list or `/object/authenticated/` downloads. The other security-live tests should pass.

## CI

GitHub Actions workflow `Test Alberta-Cars Web` uses Node 24 and `npm ci`, builds the Next.js app, runs the public security boundary tests, runs `tests/database-security.sql` when the `SUPABASE_DB_URL` repository secret is set, and runs Playwright plus a read-only load smoke. On `main` it also checks that the production catalog can be served from the Vercel CDN cache.

The CI source-tree guard fails if a legacy `production/` directory, a browser Supabase session client, or Telegram runtime references are reintroduced into `app`, `components`, `lib`, or `middleware.ts`.

## Database migrations

Update an existing database only from `supabase/migrations/`, in filename order. Apply each new file yourself with:

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --single-transaction -f path/to/migration.sql
```

`supabase/schema.sql` is an outdated sketch for a brand-new empty project. Do not apply it to the live database. It does not match production tables, policies, or grants.

Applied on the live project on 2026-10-23, in this order, and recorded in `supabase_migrations.schema_migrations`. Do not apply them again.

1. `supabase/migrations/20261023210000_signed_url_only_listing_photos.sql` — installed without `storage.allow_*` helpers; the operation check is inlined
2. `supabase/migrations/20261023211000_hide_listing_owner_from_anon.sql`
3. `supabase/migrations/20261023212000_pending_only_listing_photo_uploads.sql`
4. `supabase/migrations/20261023213000_protect_profile_trust_columns.sql`

Details and rollback are in those files and in `ops/READINESS.md`. Do not apply `schema.sql`.

## Administration

The `/admin` route is owner/admin-only. Every admin mutation rechecks membership in the `admins` table on the server. Admin tools include listing approval/removal, reports, user moderation, aggregate analytics and recent activity.

Never place a Supabase service-role key, Sentry auth token, database URL, or other server credential in browser code or a `NEXT_PUBLIC_*` variable, except values explicitly designed to be public such as the Supabase publishable key and Sentry DSN.

## Deployment

Vercel builds the repository as Next.js using Node 24 and `npm ci`. The live site uses the URL configured through `NEXT_PUBLIC_SITE_URL`. It uses the existing Supabase project. Do not point production at a different project until the pending migrations and a restore drill are done.
