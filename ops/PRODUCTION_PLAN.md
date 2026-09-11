# P2PCars production hardening status — 2026-09-11

This document separates completed code/infrastructure work from launch gates that still require an external account setting, DNS change, or physical-device validation.

| Area | Status | Current state |
| --- | --- | --- |
| Web / Telegram separation | READY | Web production no longer ships `telegram.js` or `telegram.css`; web CSP blocks Telegram framing/scripts; regression tests enforce the separation. Telegram remains on its feature branch. |
| Web CI | READY | Web-only regression tests, syntax checks, TypeScript, Next safety-net build, Supabase smoke, and read-only load smoke are automated. |
| RLS advisor warnings | READY | The two `auth_rls_initplan` policies were optimized and the Supabase performance advisor now reports no RLS warnings. |
| SEO baseline | READY | canonical, robots, sitemap, Open Graph/Twitter metadata, Organization/WebSite schema, manifest, and social image are included. Dynamic server-rendered per-listing SEO is a future enhancement. |
| Security headers | READY | Web deployment uses HSTS, CSP, frame denial, nosniff, referrer and permissions policies, plus COOP. |
| Legal/support pages | READY FOR BUSINESS REVIEW | Privacy, Terms, Contact and safety language reflect the actual private-sale marketplace and current providers. They have not been reviewed by a lawyer. |
| Support email | DNS PENDING | `support@p2pcars.ca` is wired into the site. Resend domain was created with send/receive enabled, but DNS must be added and verified before the mailbox/domain is live. |
| Production email / password recovery | EXTERNAL CONFIG PENDING | UI/recovery callback tests pass. Custom SMTP, production redirect URLs, and real delivery/reset must be completed after email-domain verification. |
| Leaked-password protection | PENDING | Supabase security advisor reports the feature disabled. Enable it in Auth when supported by the current plan. |
| CAPTCHA / Auth rate limits | REVIEW PENDING | Supabase Auth supports CAPTCHA and configurable rate limits; production values require Auth dashboard configuration and a CAPTCHA provider key. |
| Database/Storage backup restore | RESTORE DRILL PENDING | Runbook and current inventory baseline are committed. A separate-project database + Storage restore test is still required. |
| Error alerts / Sentry | PENDING EXTERNAL CONNECTION | Client errors are counted in the admin health data, but no Sentry DSN/alert destination is connected to this web deployment. |
| Load testing | BASELINE READY | Automated read-only smoke: 60 requests at concurrency 6. Observed zero failures; p95 varied from 171 ms to 2544 ms across GitHub runner regions. CI warns above 2.5 s and hard-fails above 5 s or on >2% request errors. This is not a capacity guarantee. |
| Branch protection | SETTINGS PENDING | CODEOWNERS, PR checklist and exact rule are committed, but GitHub currently has no repository ruleset and the connected GitHub App cannot change administration settings. |
| Vercel public accessibility | VERIFY AFTER MAIN DEPLOY | Vercel builds can run from GitHub, but public unauthenticated domain access must be verified on the final production deployment. |
| iPhone / Android / Desktop | PHYSICAL TEST PENDING | Automated tests cover web behavior; final launch still needs Safari iPhone, Chrome Android and desktop smoke tests on actual production. |

## Launch rule

Do not label the service "fully production verified" until DNS/email, public-domain access, recovery email, backup restore, external error alerts, branch protection, and real-device smoke testing are completed. Code changes should continue through pull requests with green CI.
