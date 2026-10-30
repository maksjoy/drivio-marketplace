export const metadata = { title: "Privacy Policy — Alberta-Cars" };

export default function PrivacyPage() {
  return (
    <article className="prose mx-auto max-w-3xl text-ink">
      <h1 className="text-3xl font-semibold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted">Last updated: October 24, 2026.</p>
      <h2 className="mt-8 text-xl font-semibold">Information we collect</h2>
      <p className="mt-2">Alberta-Cars processes account information, seller contact details, vehicle listings, photos, favorites, reports, and limited technical/security information needed to operate the marketplace.</p>
      <h2 className="mt-6 text-xl font-semibold">Public listing information</h2>
      <p className="mt-2">Vehicle details, approved listing photos, and an anonymous public nickname may be visible to marketplace users. Seller email and phone are not shown on public listings.</p>
      <h2 className="mt-6 text-xl font-semibold">How information is used</h2>
      <p className="mt-2">We use information to authenticate users, publish and moderate listings, provide favorites and private messaging, prevent abuse, troubleshoot errors, and respond to account or privacy requests.</p>
      <h2 className="mt-6 text-xl font-semibold">Service providers</h2>
      <p className="mt-2">Supabase provides authentication, database, and file storage. Vercel provides web hosting and delivery. Sentry processes technical error and performance telemetry for the production site. Resend may be used for transactional email infrastructure. When enabled, Cloudflare Turnstile checks sign-in and sign-up requests for automated abuse and may process your IP address and browser signals. Upstash stores short-lived rate-limit counters keyed to your email address or IP address to slow down repeated sign-in, sign-up, and password-reset attempts. These counters expire within an hour.</p>
      <h2 className="mt-6 text-xl font-semibold">Storage and retention</h2>
      <p className="mt-2">A sold listing may remain visible for up to 14 days. Listing photos are stored privately and delivered through time-limited links. Deleted listing photos are queued for removal from active storage.</p>
      <h2 className="mt-6 text-xl font-semibold">Security</h2>
      <p className="mt-2">We use row-level database security, server-managed authentication sessions, restricted administrative functions, HTTPS, content-security controls, private file access, private messaging, and abuse-prevention measures.</p>
      <h2 className="mt-6 text-xl font-semibold">Your choices</h2>
      <p className="mt-2">You may manage your own listings through your account. For access, correction, or deletion requests, please use the <a className="underline" href="/contact">Alberta-Cars Contact &amp; Support page</a>.</p>
      <h2 className="mt-6 text-xl font-semibold">Contact</h2>
      <p className="mt-2">For privacy questions, please use the <a className="underline" href="/contact">Alberta-Cars Contact &amp; Support page</a>.</p>
    </article>
  );
}
