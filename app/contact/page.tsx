export const metadata = { title: "Contact & Support — P2PCars.ca" };

export default function ContactPage() {
  return (
    <article className="mx-auto max-w-3xl text-prairie-800">
      <h1 className="text-3xl font-semibold">Contact & Support</h1>
      <div className="mt-6 rounded-2xl border border-prairie-200 bg-white p-5">
        <p><strong>Email:</strong> <a className="underline" href="mailto:support@p2pcars.ca">support@p2pcars.ca</a></p>
        <p className="mt-2 text-sm text-prairie-600">Use this address for account access, privacy requests, technical problems, listing moderation, or marketplace safety concerns.</p>
      </div>
      <h2 className="mt-8 text-xl font-semibold">Reporting a listing</h2>
      <p className="mt-2">When available, use the Report listing action on the vehicle page so moderation receives the correct listing context.</p>
      <h2 className="mt-6 text-xl font-semibold">Safety</h2>
      <p className="mt-2">P2PCars.ca does not take payment for vehicles and does not inspect, own, broker, or guarantee vehicles. Independently verify identity, ownership, liens, condition, history, and payment before completing a transaction.</p>
    </article>
  );
}
