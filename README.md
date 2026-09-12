# P2PCars.ca

P2PCars is an Alberta-only marketplace for private used-vehicle sales. The production application is a single **Next.js 15 + Supabase** web app deployed on Vercel. There is no second static production frontend and no Telegram runtime in this repository.

## Production architecture

- Next.js App Router is the only web application.
- Supabase provides PostgreSQL, Auth and private Storage.
- Authentication is handled server-side with secure HttpOnly cookies; access/refresh tokens are not stored in browser localStorage.
- New and edited listings are `pending` until an administrator approves them.
- Listing photos are private Storage objects delivered through short-lived signed URLs.
- Vercel serves hashed `/_next/static/*` assets with immutable caching.
- CSP uses per-request nonces and does not require `script-src 'unsafe-inline'`.
- Sentry SDK is wired for browser/server stack traces and release SHA tracking when the Sentry environment variables are configured.

## Marketplace rules and limits

- Private sellers only; dealer/commercial inventory is not allowed.
- Required listing fields: make, model, year, price, mileage, fuel and 1–8 photos.
- Seller contact is phone and/or email.
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

## CI

GitHub Actions uses Node 24 and `npm ci`, builds the canonical Next.js app, runs public security boundary tests, performs database security SQL when `SUPABASE_DB_URL` is configured as a repository secret, and runs Playwright in both Desktop Chromium and iPhone WebKit.

The CI source-tree guard fails if a legacy `production/` directory, a browser Supabase session client, or Telegram runtime references are reintroduced into the canonical web source.

## Database migrations

Existing production databases are updated incrementally from `supabase/migrations/`; do not overwrite a live database with `supabase/schema.sql`.

Important current hardening migrations include:

- secure authenticated `storage-cleanup` cron using a Supabase Vault secret;
- removal of the retired non-web integration and contact fields;
- private `listing-photos` bucket access with RLS/signed URLs.

## Administration

The `/admin` route is owner/admin-only. Every admin mutation rechecks membership in the `admins` table on the server. Admin tools include listing approval/removal, reports, user moderation, aggregate analytics and recent activity.

Never place a Supabase service-role key, Sentry auth token, database URL, or other server credential in browser code or a `NEXT_PUBLIC_*` variable, except values explicitly designed to be public such as the Supabase publishable key and Sentry DSN.

## Deployment

Vercel builds the repository as Next.js using Node 24 and `npm ci`. Production should use the canonical P2PCars domain and the same Supabase project configured for the production environment.
