# P2PCars production release candidate

The deployed website is in `production/`. See [production readiness and remaining launch gates](ops/READINESS.md). Public launch is not yet approved: hosting access, browser/email verification, backups and a real support contact remain unresolved.

Run `npm run test:production` for the deployed frontend. The Next.js application below is an older separate implementation.

---

# AlbertaCars

P2P marketplace for used vehicles in Alberta, Canada. Next.js + Supabase (Postgres, Auth and Storage).

## What is fixed in this version

- New listings are **always `pending`** and owners cannot promote them to `active` through the API or direct Supabase calls.
- The maximum of 3 pending/active listings is enforced both in the app and by a Postgres trigger (including concurrent/direct requests).
- Photo uploads are rolled back if any upload fails.
- `listing_images` insert errors are checked; uploaded files and the listing are cleaned up on failure.
- Deleting a listing also removes its files from the `listing-photos` Storage bucket.
- Signup correctly handles projects where email confirmation is enabled.
- Missing Tailwind `prairie-300/400/500/700/900` colors are defined.
- Invalid numeric filter query parameters are ignored instead of sending `NaN` to Supabase.
- Listing-query errors are handled instead of silently showing an empty marketplace.
- Next.js is upgraded from unsupported 14.x to **15.5.24** and server request APIs are migrated to async usage.
- Vehicle Make and Model are dropdowns; Model changes based on Make. Porsche and many additional brands/models are included.
- Required sell fields: Make, Model, Year, Price, Mileage, Fuel and at least 1 photo.
- Body type, city, transmission, drivetrain, colour, engine, features and description are optional.
- Seller contact supports phone, email and Telegram (at least one required).
- Search has primary filters plus an Advanced filters section.
- Favorites are implemented.
- Mobile bottom navigation: Home / Favorites / Sell / Account.
- Account page shows profile information and the user's listings, with a “Post my car” action when empty.

## IMPORTANT: update an existing Supabase database

If your Supabase project already contains the old AlbertaCars schema/data, **do not run the full schema over it**.

Open Supabase → SQL Editor and run:

`supabase/migrations/20260906_fix_listing_security.sql`

This migration preserves existing listings and adds/fixes:

- `seller_telegram`
- optional listing columns
- Favorites table + RLS
- automatic profile creation/backfill
- pending-only listing inserts
- owner status restrictions
- database-level listing limit
- `listing-photos` bucket limits/policies

For a completely new Supabase project, run `supabase/schema.sql` instead.

## Local setup

1. Install Node.js 20.9 or newer.
2. Create a Supabase project.
3. For a new database run `supabase/schema.sql`; for an existing database run the migration above.
4. Copy `.env.example` to `.env.local` and set your Supabase Project URL and anon key.
5. Run `npm install`.
6. Run `npm run dev`.

Useful checks:

- `npm run typecheck`
- `npm run build`

## Moderation

The security model intentionally prevents ordinary users from making their own listing active. To approve a listing, use a trusted/admin context such as the Supabase Table Editor/service-role backend and change `status` from `pending` to `active`.

Never put a Supabase service-role key in browser/client code or in any `NEXT_PUBLIC_*` environment variable.

## Deployment

Vercel is the simplest deployment path. Add the same two public Supabase environment variables and deploy the repository. Use Node.js 20.9+ for the deployment runtime.
