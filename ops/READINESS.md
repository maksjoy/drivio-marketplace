# Production readiness — 2026-09-11

Status: **code release candidate; a small set of external launch gates remains**.

The public web deployment is the static `production/` bundle selected by root `vercel.json`. Telegram is maintained as a separate companion flow and is no longer shipped in the web production bundle.

## Verified in this hardening pass

- Web production no longer loads or contains `telegram.js` / `telegram.css`; web CSP removes Telegram origins and denies framing. A regression test prevents accidental reintroduction.
- Web production CI includes syntax checks, frontend/photo/separation regression tests, TypeScript, the legacy Next.js safety-net build, smoke calls against the real Supabase project, and a read-only load smoke.
- First automated load smoke: 60 public-read requests, concurrency 6, 0 failures, p50 51 ms, p95 171 ms, max 253 ms. This is a sanity baseline, not a maximum-capacity guarantee.
- The two Supabase `auth_rls_initplan` warnings on `listings` and `listing_images` were fixed on production and recorded as a migration. The performance advisor now reports no RLS warnings; remaining unused-index messages are informational and expected on a small dataset.
- Web security headers now include HSTS, restrictive CSP, frame denial, COOP, nosniff, referrer policy and permissions policy.
- SEO baseline now includes canonical URL, `robots.txt`, sitemap, Open Graph/Twitter metadata, schema.org Organization/WebSite data, web manifest and a social preview asset.
- Privacy, Terms and Contact now describe the actual Alberta private-sale marketplace, current infrastructure providers, listing retention, marketplace role, moderation and safety responsibilities. These pages are business-ready drafts, not legal advice or a lawyer review.
- `support@p2pcars.ca` is now the configured support/privacy address in the site. A Resend production domain for `p2pcars.ca` was created with TLS enforced and sending/receiving enabled; DNS verification is still required before the address is live.
- Production dependency versions are pinned. CODEOWNERS and a production PR checklist are included.
- A database + Storage backup/restore runbook and current production inventory baseline are included. No production secrets or backup data are stored in GitHub.

## External launch gates still open

1. **Public Vercel accessibility.** GitHub/Vercel builds can succeed, but the connected Vercel integration exposes no owning team in this session. Confirm the final production domain opens anonymously without Deployment Protection after the `main` deployment.
2. **Real-device verification.** Test the actual production URL on iPhone Safari, Android Chrome, and desktop (Chrome/Safari/Edge where available): browsing, filters, listing gallery, signup/sign-in, sell form, large photos, account actions, favorites, report flow, legal/404 pages and keyboard/focus behavior.
3. **Email/Auth delivery.** Add and verify the Resend DNS records, configure Supabase custom SMTP/Site URL/Redirect URLs, then complete a real confirmation + password-reset round trip with a dedicated test mailbox.
4. **Leaked-password protection / CAPTCHA / Auth rate limits.** Supabase still reports leaked-password protection disabled. Enable it if supported by the plan. Configure CAPTCHA and review Auth rate limits before opening signup to broad public traffic.
5. **Backup restore drill.** A runbook exists, but a database + `listing-photos` restore into a separate non-production environment has not been performed.
6. **External error alerts.** Client errors are counted in admin health data, but there is no connected Sentry DSN/alert channel. Do not call monitoring complete until a synthetic error reaches the owner.
7. **GitHub branch protection.** The repository currently has no ruleset. The connected GitHub App lacks administration permission to create one. Enable the documented `main` rule in repository settings.
8. **Legal review if desired.** The operational Privacy/Terms drafts now match the product, but launch risk is lower if Canadian/Alberta counsel reviews them before significant scale.

## Repeatable checks

```sh
npm run test:web-production
npm run typecheck
npm run build
npm run load:smoke
```

Use `ops/PRODUCTION_PLAN.md` for the current status matrix, `ops/AUTH_EMAIL_PRODUCTION.md` for the Auth/email gate, `ops/BACKUP_RESTORE.md` for disaster recovery, and `ops/BRANCH_PROTECTION.md` for the GitHub rule.
