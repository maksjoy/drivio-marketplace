import { Card } from "@/components/ui/card";

export const metadata = { title: "Contact & Support — Alberta Cars" };

export default function ContactPage() {
  return (
    <article className="mx-auto max-w-3xl text-ink">
      <h1 className="text-3xl font-semibold">Contact & Support</h1>
      <Card className="mt-6 p-5">
        <p><strong>Email:</strong> <a className="underline" href="mailto:support@p2pcars.ca">support@p2pcars.ca</a></p>
        <p className="mt-2 text-sm text-muted">Use this address for account access, privacy requests, technical problems, listing moderation, or marketplace safety concerns.</p>
      </Card>
      <h2 className="mt-8 text-xl font-semibold">Reporting a listing</h2>
      <p className="mt-2">When available, use the Report listing action on the vehicle page so moderation receives the correct listing context.</p>
      <h2 className="mt-6 text-xl font-semibold">Safety</h2>
      <p className="mt-2">Alberta Cars does not take payment for vehicles and does not inspect, own, broker, or guarantee vehicles. Independently verify identity, ownership, liens, condition, history, and payment before completing a transaction.</p>
    </article>
  );
}
