# Alberta-Cars production status — 2026-10-23

This replaces the 2026-09-11 plan. That plan described a static `production/` bundle, a Telegram companion, and Sentry as not connected. None of those descriptions match the app on `main`.

TODO: do not change the live hostname, `NEXT_PUBLIC_SITE_URL`, or `support@p2pcars.ca` until a domain is purchased and the mailbox works.

| Area | Status | Current state |
| --- | --- | --- |
| Web app | LIVE | Next.js 15 on Vercel. `vercel.json` builds this repository as Next.js. There is no static `production/` directory. |
| Telegram | REMOVED FROM THE WEB APP | No Telegram runtime in the canonical source. CI rejects those references. Historical work stays on `feat/telegram-mini-app` and is not deployed. |
| Sentry | CONNECTED | `@sentry/nextjs` is initialized for browser, Node, and edge. The Vercel deployment emits Sentry trace headers. Source-map upload still needs the server-side Sentry build credentials when a release should be symbolicated. |
| Photos | CODE READY, SQL PENDING | The app requests signed URLs. Anonymous listing and `/object/authenticated/` reads stay possible until `20261023210000_signed_url_only_listing_photos.sql` is applied. See `ops/READINESS.md`. |
| Listing owner id | CODE READY, SQL PENDING | Anonymous pages no longer select `listings.user_id`. The column remains readable by `anon` until `20261023211000_hide_listing_owner_from_anon.sql` is applied after the photo migration. |
| Schema file | DO NOT APPLY | `supabase/schema.sql` is an outdated sketch. Live changes are only the timestamped files in `supabase/migrations/`. |
| CI | READY, WITH A KNOWN RED STEP | Workflow `Test Alberta-Cars Web`: typecheck, build, `test:security-live`, optional database SQL, Playwright, load smoke, and a `main` CDN check. The two security-live assertions above fail until the SQL is applied. |
| Security headers | READY | HSTS, CSP with per-request nonces, frame denial, COOP, nosniff, referrer policy, and permissions policy. Inter is self-hosted, so Google Fonts is not required. |
| SEO | PARTIAL | Canonical URLs use `NEXT_PUBLIC_SITE_URL` or the current Vercel fallback. `robots.txt`, sitemap, manifest, and Open Graph image exist. The public domain is not purchased, so the canonical host must not be switched yet. |
| Legal pages | BUSINESS DRAFT | Privacy, Terms, and Contact use the Alberta-Cars name and the current providers, including connected Sentry. They are not a legal opinion. The support address is unchanged on purpose. |
| Support email | NOT LIVE | `support@p2pcars.ca` remains in the UI. TODO: keep it until the domain is purchased and delivery is verified. |
| Auth email | EXTERNAL CONFIG PENDING | UI and server recovery routes exist. A real confirmation and reset round trip is still required after SMTP and redirect URLs are set. See `ops/AUTH_EMAIL_PRODUCTION.md`. |
| Leaked-password screening | APP CHECK ONLY | Signup hashes the password and queries the HIBP range API. The Supabase Auth dashboard setting is separate and was still reported disabled. |
| CAPTCHA / Auth rate limits | DASHBOARD PENDING | Not enforced in the app. Configure them in Supabase Auth before broad public signup. |
| Backup restore | RUNBOOK ONLY | `ops/BACKUP_RESTORE.md`. No separate-project restore drill is recorded. The 2026-09-11 inventory counts are historical, not the current catalog. |
| Branch protection | SETTINGS PENDING | Desired rule is in `ops/BRANCH_PROTECTION.md`. This session could not confirm a GitHub ruleset on `main`. |
| Load smoke | BASELINE ONLY | `npm run load:smoke` is a read-only sanity check. It is not a capacity test. |
| Real devices | STILL WORTH DOING | Automated Playwright covers desktop and mobile viewports. A pass on a physical phone is still the launch check for keyboard and photo behavior. |

## Launch rule

Do not call the marketplace fully launched until the domain and mailbox exist, auth email delivery is proven, the two pending migrations are applied and `npm run test:security-live` is green, a backup restore drill is recorded, and branch protection is enabled. Code changes still go through pull requests. Typecheck and build should be green. The two security-live failures are expected only while those migrations are unapplied.
