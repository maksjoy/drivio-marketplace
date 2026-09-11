# Production Auth and email launch gate

## Current verified state — 2026-09-11

- Supabase security advisor reports leaked-password protection is disabled.
- The web UI contains signup, sign-in, password-recovery request, recovery callback validation, and password-change flows; these are covered by regression tests.
- Actual delivery of confirmation/reset email is **not** yet verified.
- Resend production domain `p2pcars.ca` has been created with TLS enforced and both sending/receiving enabled, but DNS verification is still required before `support@p2pcars.ca` or an auth sender on this domain can be considered live.

## Required Supabase Auth settings before launch

1. Site URL: `https://p2pcars.ca`
2. Allowed redirect URLs should include the production origin and only intentional preview/development origins.
3. Configure custom SMTP using the verified P2PCars sender domain; do not rely on the default development mail sender for public launch.
4. Enable leaked-password protection when the Supabase plan supports it.
5. Enable CAPTCHA (Cloudflare Turnstile or hCaptcha) for public signup/auth abuse protection and configure the matching frontend token flow before enforcing it.
6. Review Auth rate limits for email sends, token refresh, password verification and signup/sign-in traffic; keep limits conservative until normal traffic is understood.
7. Use a unique test mailbox to complete the end-to-end launch test: sign up → receive confirmation → confirm → sign in → request reset → receive reset → follow link → change password → sign in with the new password.

## Resend DNS records created for `p2pcars.ca`

- DKIM TXT `resend._domainkey` → `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCuGCRA/c2uOMYjSbwS42jkbHkkIng39Zs0v3U2n2RKP1HDyJVZmHLOjVb4VSOd7NNFDUX0bSR+/4FX5tk6Zb91lYulKkPSkXrtge7alVGArpVmRlabWlI9MIJ59QFPxm809A2Z/HOWcmE/VCuIZFBPfAkpCtSJMfxNLD2ZVct00wIDAQAB`
- Return-path MX `send` → `feedback-smtp.us-east-1.amazonses.com`, priority 10
- SPF TXT `send` → `v=spf1 include:amazonses.com ~all`
- Return-path CNAME `rsend` → `send.forge.rmta.net`
- Receiving MX at the root domain → `inbound-smtp.us-east-1.amazonaws.com`, priority 10

After DNS propagation, run Resend domain verification and only then switch production support/Auth mail to the domain.
