# P2Pcars Telegram edition

Repository: `maksjoy/drivio-marketplace`
Branch: `feat/telegram-mini-app`
Bot: `@P2pcarsalbertabot`
Main website branch: `main` (not merged or updated by this work).

The Telegram branch is a parallel product with its own deployment. `production/` is the deployed static frontend; the root Next.js scaffold is not the production frontend. Both products continue to use the existing Supabase database, photos, listing moderation and admin membership. A Git branch isolates code, not the shared database. No existing website account is automatically merged with a Telegram identity.

## Implemented

- Telegram theme colours (including theme changes), system typography, compact two-column car cards, flat four-tab navigation, safe-area padding and full-height detail/account screens.
- Native Telegram BackButton and MainButton for seller contact and form submission. HTML controls remain usable on older clients.
- Public browsing; a large Open in Telegram button for people arriving in a browser.
- Automatic server-verified Telegram login; no user-facing email, phone or password registration.
- Stable Telegram ID mapped to a Supabase account. Username/name are refreshed on each launch. Supabase sessions continue to enforce listing ownership, favourites and moderation RLS.
- Seller contact is taken from the server-owned identity mapping, overriding forged form fields. Buyers open the seller's Telegram chat with a prefilled car enquiry; they choose whether to send it.
- Accounts without a username can browse and save cars, but must add a public Telegram username before posting. Removing a username hides active/pending listings and clears stale contacts. Re-adding it does not auto-publish a removed listing; the seller can resubmit for moderation.
- `/start` and `/help` webhook replies contain one wide inline Web App launch button. The menu and profile button setup is described below.

## Deployed backend / current activation status

On 2026-09-08 the additive `telegram_verified_accounts_and_contacts` migration was applied to project `rjoipowznfokhvahuozf`, and Edge Functions `telegram-auth` and `telegram-bot` were deployed. The migration SQL is in `ops/telegram-auth-schema.sql`.

The bot token is not configured; both functions refuse to authenticate/process bot updates until it is set. The new frontend is saved in its separate GitHub branch. The connected Vercel app currently returns 403 for project access, so a separate public production deployment and bot activation still need to be completed. The existing bot continues to point to its prior URL until BotFather/menu settings are changed.

## Finish activation

1. Create a separate Vercel project from this repository, with production branch `feat/telegram-mini-app`. Keep the main website project on `main`. Use the root directory, Framework Preset Other, output `production`, build command `npm run test:production`; the committed root `vercel.json` supplies these settings. Use Node 22.6+ (22 LTS or 24). The proposed project name is `p2pcars-telegram`; it is not claimed to exist yet.
2. Ensure the deployment opens publicly without a Vercel sign-in. Telegram cannot authenticate through Vercel Deployment Protection.
3. Set these Supabase Edge Function secrets (not frontend variables):
   - `P2PCARS_TELEGRAM_BOT_TOKEN`: token for `@P2pcarsalbertabot` from BotFather.
   - `P2PCARS_APP_URL`: the exact public HTTPS URL of the separate Telegram deployment. This also controls the exact allowed CORS origin. Default code origin is `https://p2pcars-telegram.vercel.app`, but use the real assigned URL.
   The Supabase URL and service-role key are supplied automatically to deployed functions. No service-role key or bot token belongs in GitHub or browser code.
4. With those same two environment variables set locally, run `node scripts/connect-telegram.mjs`. It checks that the app is the Telegram edition, verifies the bot username and webhook secret, sets the menu button, commands/descriptions and webhook, then reads the saved settings back. It does not message existing users. If an unrelated webhook exists, it stops for inspection; `--replace-webhook` is an explicit override after reviewing that destination.
5. In BotFather: `/mybots` → `@P2pcarsalbertabot` → Bot Settings → Configure Mini App → Main Mini App URL. Set the same public URL to enable the native profile launch button and `?startapp` listing links. This setting cannot be changed with `setChatMenuButton`.
6. Open the bot on a phone, tap Start, then Open P2Pcars. Verify automatic account access, a pending listing with a photo, direct seller chat, dark mode and the bottom safe area. A real device login cannot be verified without the bot token and final deployment.

## Security and verification

### Photo uploads (2026-09-09)

The deployed static frontend uses `production/photos.js` for both new listings and edits. Original photos have no application byte-size or dimension ceiling. JPEG, PNG and other browser-decodable raster photos are resized proportionally, oriented by the browser, and encoded to JPEG before upload. HEIC/HEIF falls back to the pinned, local `heic-to` CSP decoder when native decoding is unavailable. The decoder loads only when needed. Both Vercel configurations allow local blob images and decoder workers.

Full images are at most 1920 pixels on the long edge and 2,200 KiB; cover thumbnails are at most 720 pixels and 350 KiB. This fits the existing 3 MiB Storage bucket limit. Originals are processed sequentially and are never uploaded as a fallback. If decoding or encoding fails, the seller sees an error identifying the photo. New listings are created only after all original photos have been prepared. The existing limit of eight photos per listing is unchanged.

Real limits still depend on the device's available memory and supported codecs; this is automatic preparation, not unlimited original-file archival storage. `tests/photos.test.cjs` covers dimensions, EXIF orientation, byte budgets, legacy image decoding, cleanup and failures. Frontend tests cover large originals in both posting and editing, and no listing creation after failed preparation. The local suite passed 47 tests. Remote browser validation was blocked by the environment's browser URL policy, so an actual Telegram device upload was not claimed.

`npm run test:production` runs frontend behaviour, Telegram controls and backend signature/account/webhook tests. `tests/telegram-database-security.sql` performs transaction-only RLS/ownership/contact-sync checks and rolls back its generated fixtures. Nine checks passed against the actual database. New mapping tables intentionally have no client RLS policies and no client grants. Security Advisor's no-policy info for that service-only table is expected; pre-existing website admin-RPC/password advisories remain outside this branch change.

Auth rejects duplicate fields, modified signatures, data for another bot, payloads older than five minutes and future timestamps. `initDataUnsafe` is used only for validated listing navigation. A public username is never accepted as a login credential. Sessions are refreshed normally and identity is reverified on every Mini App launch. Never grant admin based on a username or user-editable metadata; existing admin accounts continue through the main website.

References: [Telegram Mini Apps](https://core.telegram.org/bots/webapps), [Bot API menu buttons](https://core.telegram.org/bots/api#setchatmenubutton), [Supabase passwordless session exchange](https://supabase.com/docs/guides/auth/auth-email-passwordless).
