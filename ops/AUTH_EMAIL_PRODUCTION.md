# Production Auth and email launch gate

TODO: do not replace `p2pcars.ca` or `support@p2pcars.ca` in this runbook until a domain is purchased and DNS plus mailbox delivery are verified. The names below are the addresses already written down, not a statement that the domain is live.

## Current verified state — 2026-10-23

- Supabase security advisor reports leaked-password protection is disabled.
- The web UI contains signup, sign-in, password-recovery request, recovery callback validation, and password-change flows; these are covered by regression tests.
- Actual delivery of confirmation/reset email is **not** yet verified.
- Resend production domain `p2pcars.ca` has been created with TLS enforced and both sending/receiving enabled, but DNS verification is still required before `support@p2pcars.ca` or an auth sender on this domain can be considered live.

## Required Supabase Auth settings before launch

1. Site URL: `https://p2pcars.ca`
2. Allowed redirect URLs should include the production origin and only intentional preview/development origins.
3. Configure custom SMTP using the verified Alberta-Cars sender domain once that domain exists; do not rely on the default development mail sender for public launch. Keep the documented `p2pcars.ca` values until then.
4. Enable leaked-password protection when the Supabase plan supports it.
5. Turnstile is the CAPTCHA. Deploy the app and set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in Vercel first. Confirm the sign-in, signup, and recovery forms show the widget and sign-in still succeeds. Only then enable CAPTCHA in Supabase Auth, choose Cloudflare Turnstile, and paste the Turnstile secret there. Do not put that secret in Vercel. Enabling the Supabase check before the site key is live rejects every sign-in.
6. Auth attempt limits use Upstash Redis (`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`). Set both before relying on them. If either is unset, the app skips limiting and logs a warning instead of blocking login. Also review Supabase Auth limits for email sends, token refresh, and password verification; keep those conservative until normal traffic is understood.
7. Use a unique test mailbox to complete the end-to-end launch test: sign up → receive confirmation → confirm → sign in → request reset → receive reset → follow link → change password → sign in with the new password.

## Resend DNS records created for `p2pcars.ca`

- DKIM TXT `resend._domainkey` → `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCuGCRA/c2uOMYjSbwS42jkbHkkIng39Zs0v3U2n2RKP1HDyJVZmHLOjVb4VSOd7NNFDUX0bSR+/4FX5tk6Zb91lYulKkPSkXrtge7alVGArpVmRlabWlI9MIJ59QFPxm809A2Z/HOWcmE/VCuIZFBPfAkpCtSJMfxNLD2ZVct00wIDAQAB`
- Return-path MX `send` → `feedback-smtp.us-east-1.amazonses.com`, priority 10
- SPF TXT `send` → `v=spf1 include:amazonses.com ~all`
- Return-path CNAME `rsend` → `send.forge.rmta.net`
- Receiving MX at the root domain → `inbound-smtp.us-east-1.amazonaws.com`, priority 10

After DNS propagation, run Resend domain verification and only then switch production support/Auth mail to the domain.
