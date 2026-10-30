# Production readiness — 2026-10-23

Status: **the Next.js app is what production serves. It is not launch-complete.** The public site is Alberta-Cars on Vercel. Sentry is connected. There is no Telegram app and no static `production/` bundle.

The live hostname is the current Vercel deployment. The official Alberta-Cars public domain and support mailbox are not yet verified. Keep URL configuration unchanged until an official Alberta-Cars domain is configured and tested; do not publish an unverified support address.

## What production actually is

- One Next.js 15 App Router app. `vercel.json` selects the Next.js framework, not a static `production/` directory. That directory is not in this repository, and CI fails if it is reintroduced.
- Telegram is not part of the web app. CI rejects Telegram runtime references in `app`, `components`, `lib`, and `middleware.ts`. Old Telegram work remains only on the historical `feat/telegram-mini-app` branch.
- Supabase provides Auth, Postgres, and the private `listing-photos` bucket. The app creates short-lived signed photo URLs.
- Sentry (`@sentry/nextjs`) is initialized for the browser, Node, and edge runtimes, and the Vercel deployment sends Sentry trace data. Source-map upload still depends on `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` being set in the build environment.
- Signup screens new passwords against the Have I Been Pwned range API before `signUp`. Supabase leaked-password protection remains a separate dashboard setting and is not a substitute for that check. Turnstile and Upstash rate limits ship in the app and stay inactive until their env vars are set. See the rollout in `README.md`.
- GitHub Actions workflow `Test Alberta-Cars Web` runs typecheck, unit tests, production build, live security smoke, optional `tests/database-security.sql` when `SUPABASE_DB_URL` is set, Playwright, a read-only load smoke, and on `main` a catalog CDN cache check.
- There is no `npm run test:web-production` script. Use the commands in the section below.

## Database workflow

Do not apply `supabase/schema.sql` to the live database. It is an outdated fresh-project sketch.

Apply new SQL from `supabase/migrations/` in filename order, one file per transaction:

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --single-transaction -f supabase/migrations/<file>.sql
```

These four files were applied to the live project `rjoipowznfokhvahuozf` on 2026-10-23 through the Management API and recorded in `supabase_migrations.schema_migrations`. Do not apply them again.

1. `supabase/migrations/20261023210000_signed_url_only_listing_photos.sql`
   - Applied in adapted form. The draft that created `storage.allow_*` failed with `permission denied for schema storage`. The installed policies inline the operation check and allow only `object.sign`, `object.sign_many`, `object.get_signed`, and `render.image_sign` after stripping a leading `storage.` prefix. The repo file now matches that install.
   - Anonymous and signed-in clients can sign and download listing photos. Bucket listing and `/storage/v1/object/authenticated/` reads are blocked.
   - Rollback comment restores the previous live policy name, `Read authorized listing photos`.
2. `supabase/migrations/20261023211000_hide_listing_owner_from_anon.sql`
   - Applied as written. `anon` no longer has table-level `SELECT` on `public.listings`. The public columns are granted, excluding `user_id`, `seller_phone`, and `seller_email`.
   - `authenticated` keeps table-level `SELECT`.
   - Rollback if a public page starts returning permission errors: `grant select on table public.listings to anon;`
3. `supabase/migrations/20261023212000_pending_only_listing_photo_uploads.sql`
   - Applied as written. Owners can insert into `listing-photos` only while their listing is `pending`.
   - A pending listing with fewer than eight image rows can still receive a new object, because `createSignedUploadUrl` checks the insert policy before `listing_images` exists. Once eight images are registered, only those paths can be uploaded.
   - Rollback comment restores the previous pending/active/sold/removed insert policy.
4. `supabase/migrations/20261023213000_protect_profile_trust_columns.sql`
   - Applied as written. `phone_verified`, `is_dealer_flagged`, and `dealer_report_count` cannot be changed by the account owner. `service_role`, an admin, and the database owner without a user JWT still can.
   - Phone, display name, and `system_messages_read_at` stay writable.
   - Rollback: `drop trigger if exists protect_profile_trust_columns on public.profiles;` then `drop function if exists private.protect_profile_trust_columns();`

After this apply, `npm run test:security-live` is 9 passing tests. `tests/database-security.sql` runs the upload and profile assertions when `SUPABASE_DB_URL` is set.

## Still open

1. **Domain and canonical URL.** Do not switch the site URL until an official Alberta-Cars domain is configured and verified.
2. **Support mailbox.** The previous unverified support address has been removed from the public UI. Publish a support address only after the official Alberta-Cars mailbox is configured and mail delivery is verified.
3. **Auth email, CAPTCHA, and rate limits.** Confirmation and password-reset delivery have not been completed against a real mailbox. See `ops/AUTH_EMAIL_PRODUCTION.md`. Leaked-password protection in the Supabase dashboard is still an external setting. Turnstile and Upstash are in the app but inactive until `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN` are set in Vercel. Enable CAPTCHA in Supabase only after the widget is visible and sign-in still works. The Turnstile secret belongs in Supabase, not in Vercel.
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

`npm run test:security-live` is 9 passing tests after the 2026-10-23 migrations. Typecheck and build should pass.
