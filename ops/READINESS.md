# Production readiness — 2026-10-23

Status: **the Next.js app is what production serves. It is not launch-complete.** The public site is Alberta-Cars on Vercel. Sentry is connected. There is no Telegram app and no static `production/` bundle.

The live hostname is the current Vercel deployment. TODO: a public domain is not purchased yet. Leave `NEXT_PUBLIC_SITE_URL`, the fallback in `lib/site-url.ts`, and `support@p2pcars.ca` unchanged until that domain and mailbox exist.

## What production actually is

- One Next.js 15 App Router app. `vercel.json` selects the Next.js framework, not a static `production/` directory. That directory is not in this repository, and CI fails if it is reintroduced.
- Telegram is not part of the web app. CI rejects Telegram runtime references in `app`, `components`, `lib`, and `middleware.ts`. Old Telegram work remains only on the historical `feat/telegram-mini-app` branch.
- Supabase provides Auth, Postgres, and the private `listing-photos` bucket. The app creates short-lived signed photo URLs.
- Sentry (`@sentry/nextjs`) is initialized for the browser, Node, and edge runtimes, and the Vercel deployment sends Sentry trace data. Source-map upload still depends on `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` being set in the build environment.
- Signup screens new passwords against the Have I Been Pwned range API before `signUp`. Supabase leaked-password protection and CAPTCHA are separate dashboard settings and are not a substitute for that check.
- GitHub Actions workflow `Test Alberta-Cars Web` runs typecheck, production build, live security smoke, optional `tests/database-security.sql` when `SUPABASE_DB_URL` is set, Playwright, a read-only load smoke, and on `main` a catalog CDN cache check.
- There is no `npm run test:web-production` script. Use the commands in the section below.

## Database workflow

Do not apply `supabase/schema.sql` to the live database. It is an outdated fresh-project sketch.

Apply new SQL from `supabase/migrations/` in filename order, one file per transaction:

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --single-transaction -f supabase/migrations/<file>.sql
```

The app in `main` already works before and after the two migrations below. Apply them manually. They were not applied when PR #18 merged.

1. `supabase/migrations/20261023210000_signed_url_only_listing_photos.sql`
   - Allows anonymous and signed-in clients to sign and download listing photos only.
   - Blocks bucket listing and `/storage/v1/object/authenticated/` reads.
   - Safe with the current app because catalog and listing pages already call `createSignedUrls`.
   - Open a live listing immediately after. If photos fail, run the rollback comment at the bottom of that file and stop.
2. `supabase/migrations/20261023211000_hide_listing_owner_from_anon.sql`
   - Apply only after step 1 and only while production is serving this app.
   - Revokes table-level `SELECT` on `public.listings` from `anon` and grants the public columns, excluding `user_id`, `seller_phone`, and `seller_email`.
   - `authenticated` keeps table-level `SELECT`, so account, admin, and messaging queries that filter on `user_id` keep working.
   - Rollback if a public page starts returning permission errors: `grant select on table public.listings to anon;`

Until both files are applied, `npm run test:security-live` fails exactly two tests: anonymous `select=user_id`, and anonymous list or authenticated-path download of `listing-photos`. Signed photo URLs and `select=id,make,model` still succeed. Re-run the command after the SQL. A green run is 9 passing tests.

## Still open

1. **Domain and canonical URL.** Do not switch the site URL until a domain is purchased. `p2pcars.ca` is not the live site.
2. **Support mailbox.** The UI still shows `support@p2pcars.ca`. TODO: replace that address only after the domain exists and mail delivery is verified.
3. **Auth email.** Confirmation and password-reset delivery have not been completed against a real mailbox. See `ops/AUTH_EMAIL_PRODUCTION.md`. Leaked-password protection in the Supabase dashboard and CAPTCHA are still external settings.
4. **Backup restore drill.** `ops/BACKUP_RESTORE.md` is the procedure. A restore into a separate project has not been recorded.
5. **Branch protection.** GitHub rules for `main` were not confirmed from this repository session. The intended rule is in `ops/BRANCH_PROTECTION.md`. The required check name is the `build` job in `Test Alberta-Cars Web`.
6. **Legal review.** Privacy, Terms, and Contact match the current product and use the Alberta-Cars name. They are operational drafts, not a lawyer's review.
7. **Catalog data.** Production still has the two existing test listings. Do not delete them from this documentation task.

## Repeatable checks

```sh
npm run typecheck
npm run build
npm run test:security-live
npm run test:e2e
npm run load:smoke
```

Expect the two migration tests in `test:security-live` to fail until the SQL above is applied. Typecheck, build, and the other security-live tests should pass.
