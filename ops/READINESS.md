# Production readiness — 2026-09-07

Status: **release candidate; public launch remains blocked**.

The deployed application is `production/` (plain HTML/CSS/JavaScript + the existing Supabase project), not the older Next.js application at repository root. Root `vercel.json` selects the correct output and runs its frontend tests. `production/vercel.json` supports deployment of that directory alone. Never publish the entire repository as a static directory.

## Completed and verified

- 28 database checks, executed with real `anon` and `authenticated` roles in one rolled-back transaction. Coverage: automatic profile creation; ownership; private profile visibility; preventing admin self-assignment; pending-only insertion; owner activation denial; 3-listing limit; photo ownership; admin photo visibility and activation; photo requirement; favorites; duplicate reports; review; blocking; Sold/Remove; anonymous admin RPC denial.
- 12 Node frontend regression tests: corrupted session storage; HTML injection escaping in cards/detail/admin; Porsche models; invalid ranges; bounded pagination; favorites independent of search; photo count/type validation; upload rollback; duplicate-submission prevention; recovery callback token validation; password mismatch; mobile-account sign-out and handler syntax. These use a minimal DOM fixture and mocked API responses, not a real browser.
- 14 live HTTP checks with one temporary synthetic account: password login, user lookup, refresh, admin denial, pending insert, actual PNG upload, photo attachment and join, activation denial, Sold, Remove, photo cleanup, listing cleanup, logout. No email was sent. The temporary account was removed; zero test photos remain. Original user/admin/listing counts are unchanged (1 each).
- Applied `supabase/migrations/20260907001412_production_readiness.sql` to the existing project after the rollback trial succeeded. This patch requires the existing production schema; it is not a complete fresh-project bootstrap.
- All public tables have RLS. Admin membership remains unchanged. Anonymous EXECUTE privileges were removed from the three admin functions. Their authenticated EXECUTE privilege is deliberate: each function checks `admins` server-side. Negative authorization tests pass. Supabase still reports these guarded functions as warnings; they are not anonymously callable.
- Fixed the blocked-seller check: invoker triggers can now read the caller's own moderation state. No user can edit that state.
- Escaped untrusted listing, account, report and admin text before HTML rendering. Safe image path encoding, Telegram contacts, additional photo gallery, keyboard-capable card buttons, modal focus handling, mobile sign-out, visible mobile legal links.
- Added recovery forms, verified-token callback handling, session refresh, sign-out API request, upload timeout, preflight validation and pending-only submission.
- Added primary/advanced filters, reset, 24-result pagination and favorites fetching independent of the current search (latest 100 favorites).
- Added Vercel security headers and frontend tests to CI. JS/CSS are separate files.
- Basic signed-in error events only: one `client_error` per page session, without stack traces, email, password or message contents. Anonymous analytics writes were closed to avoid an unrestricted write endpoint. Existing dashboard counts therefore **do not represent all visitors or unique active users**. No alert destination is configured.

## Still required before public launch

1. **Hosting access:** connected Vercel account reports no teams and project inspection returns 403 for the deployment's scope. The existing alias redirects visitors to Vercel sign-in. Reconnect the Vercel account/team that owns this deployment, verify project ownership, then configure public production access in Deployment Protection. Do not assume a successful deployment response means a publicly usable site.
2. **Real browser verification:** the cloud browser refused the local test address (`ERR_BLOCKED_BY_CLIENT`). Desktop and mobile visual checks, click-through flows and keyboard focus behavior are not verified in a browser. Repeat on the accessible production URL, including 404 and legal pages.
3. **Email delivery and recovery:** confirm production Site URL and Redirect URLs in Supabase Auth; configure and verify an owned SMTP sender. Test a new user's confirmation email and a password-reset email, follow each link, change password and sign in again. Recovery UI tests do not establish actual delivery. The connector does not expose these settings. Do not send messages to arbitrary real addresses for testing.
4. **Backups:** confirm the plan's actual backup availability, latest successful backup timestamp and retention in Supabase. Make a separate backup of Storage files (database backups do not include file bytes); protect it with restricted access/encryption. Restore database plus photo files into a separate project and verify a representative listing. Neither automatic backups nor a restore drill were verified in this session. Do not copy account data or backup credentials into this public repository.
5. **Contact/privacy:** `production/contact.html` still has placeholder operator-contact instructions. Supply an actual support address and operator details, add a working route for account/privacy requests, and verify it. No mailbox or domain ownership has been established.
6. **Error alerts:** connect an error-monitoring service and verify a synthetic error reaches the owner. PostHog was declined for this request; no external monitoring service is connected. Basic database events are not uptime monitoring or alerts.
7. **Abuse safeguards:** review Auth rate limits and CAPTCHA, and leaked-password protection (currently disabled). Authenticated analytics and public photo URLs still need operational retention/abuse monitoring. Removing a listing hides it from searches; already-known public photo URLs remain accessible until files are deleted. This is not account-data erasure.

No 10,000-daily-user capacity claim is made. There is no load-test result. Run a controlled load test against a staging project before advertising that capacity.

## Repeatable checks

```sh
npm run test:production
node --check production/app.js
```

Run `tests/database-security.sql` against the intended database using a trusted SQL connection; it always ends with ROLLBACK and must never be edited to commit the fixtures. For a complete release, additionally run real browser/auth/email/storage tests and a restore drill above.

Supabase advisor reference: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
Password protection reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
Backup reference: https://supabase.com/docs/guides/platform/backups

## Deployment attempt

The Vercel connector accepted an updated production deployment: `dpl_8PRRL8qduXzT2S6dvNMSrb2FXwou`, URL `https://p2pcars-alberta-91aanris8-8km78p7mxw-2551.vercel.app`, alias `https://p2pcars-alberta-8km78p7mxw-2551.vercel.app`. The response was INITIALIZING; READY and public accessibility must be checked after the Vercel connection is corrected.
