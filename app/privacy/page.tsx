export const metadata = { title: "Privacy Policy — P2PCars.ca" };

export default function PrivacyPage() {
  return (
    <article className="prose mx-auto max-w-3xl text-prairie-800">
      <h1 className="text-3xl font-semibold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-prairie-500">Last updated: September 11, 2026.</p>
      <h2 className="mt-8 text-xl font-semibold">Information we collect</h2>
      <p className="mt-2">P2PCars.ca processes account information, seller contact details, vehicle listings, photos, favorites, reports, and limited technical/security information needed to operate the marketplace.</p>
      <h2 className="mt-6 text-xl font-semibold">Public listing information</h2>
      <p className="mt-2">Vehicle details, approved listing photos, seller display information, and the phone or email contact a seller chooses for a listing may be visible to marketplace users.</p>
      <h2 className="mt-6 text-xl font-semibold">How information is used</h2>
      <p className="mt-2">We use information to authenticate users, publish and moderate listings, provide favorites and seller contact features, prevent abuse, troubleshoot errors, and respond to account or privacy requests.</p>
      <h2 className="mt-6 text-xl font-semibold">Service providers</h2>
      <p className="mt-2">Supabase provides authentication, database, and file storage. Vercel provides web hosting and delivery. Sentry may process technical error and performance telemetry when production monitoring is enabled. Resend may be used for transactional email infrastructure.</p>
      <h2 className="mt-6 text-xl font-semibold">Storage and retention</h2>
      <p className="mt-2">A sold listing may remain visible for up to 14 days. Listing photos are stored privately and delivered through time-limited links. Deleted listing photos are queued for removal from active storage.</p>
      <h2 className="mt-6 text-xl font-semibold">Security</h2>
      <p className="mt-2">We use row-level database security, server-managed authentication sessions, restricted administrative functions, HTTPS, content-security controls, private file access, and abuse-prevention measures.</p>
      <h2 className="mt-6 text-xl font-semibold">Your choices</h2>
      <p className="mt-2">You may manage your own listings through your account. For access, correction, or deletion requests, contact <a className="underline" href="mailto:support@p2pcars.ca">support@p2pcars.ca</a>.</p>
      <h2 className="mt-6 text-xl font-semibold">Contact</h2>
      <p className="mt-2">Privacy questions: <a className="underline" href="mailto:support@p2pcars.ca">support@p2pcars.ca</a>.</p>
    </article>
  );
}
