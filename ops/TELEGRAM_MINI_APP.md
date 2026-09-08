# P2PCars Telegram Mini App

Bot: @P2pcarsalbertabot
App URL: https://p2pcars-alberta.vercel.app/?miniapp=1

This is the existing production marketplace with a Telegram presentation layer. It uses the same Supabase project, accounts, listings, favorites and admin permissions. No database migration is needed. It is not the Burger Room project.

## Owner setup in BotFather

1. /mybots → @P2pcarsalbertabot → Bot Settings → Configure Mini App → Enable Mini App.
2. Set the HTTPS App URL above as the Main Mini App URL. A public HTTPS URL without hosting sign-in protection is required.
3. Optionally use /setmenubutton, select the same bot, provide the App URL and button text "Browse cars".
4. Open the bot profile and launch the app. On iOS/Android check search, photo gallery, back navigation, favorites, sign-in, photo upload and account access.
5. Open a shared listing using https://t.me/P2pcarsalbertabot?startapp=car_LISTING_UUID (substitute a real public listing UUID).

/newapp is optional for additional named apps. A Main Mini App must be configured for the short ?startapp= links used by Telegram sharing. No bot token is needed merely to configure these launch buttons in BotFather. A bot token and separate backend are needed later for automated chat replies or verified Telegram login.

## Authentication

Browsing is anonymous. Posting, favorites and moderation keep the existing P2PCars sign-in and server-enforced RLS. Browser and Telegram WebView sessions are separate; use the same P2PCars login in each. Telegram initDataUnsafe is used ONLY for a public listing navigation parameter, validated as a UUID. It never establishes identity or grants admin access. Automatic sign-in with Telegram is not implemented.

## Included

- Responsive compact layout selected by ?miniapp=1 or real Telegram launch data.
- Official SDK is loaded only for Mini App launches; ordinary website stays functional without it.
- Native expand, safe/content insets, native back button, seller Telegram links, gentle navigation haptics and confirmation when closing a modified form.
- Share listing to Telegram; browser share/copy fallback.
- Public listing deep links and a clear unavailable-listing state.
- CSP permits official telegram.org script and framing only by self and Telegram Web origins. It does not allow arbitrary framing. Both root and production-folder deployment configurations match.

## Verification

Run `node --test tests/frontend.test.cjs tests/telegram.test.cjs`.
The 19 tests exercise existing marketplace behavior plus mocked Telegram startup, SDK fallback, safe areas, back navigation, valid/invalid listing deep links, sharing and deployment security headers. These do not replace an actual device launch inside Telegram. BotFather configuration and device testing remain owner steps until bot access is supplied.
