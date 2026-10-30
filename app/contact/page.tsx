import { Card } from "@/components/ui/card";

export const metadata = { title: "Contact & Support — Alberta-Cars" };

export default function ContactPage() {
  return (
    <article className="mx-auto max-w-3xl text-ink">
      <h1 className="text-3xl font-semibold">Contact & Support</h1>
      <Card className="mt-6 p-5">
        <p className="font-medium">Alberta-Cars support</p>
        <p className="mt-2 text-sm text-muted">For listing-specific concerns, use the Report listing action on the vehicle page when available so the moderation team receives the correct context. Verified support contact details will be published here once the official Alberta-Cars support channel is ready.</p>
      </Card>
      <h2 className="mt-8 text-xl font-semibold">Reporting a listing</h2>
      <p className="mt-2">When available, use the Report listing action on the vehicle page so moderation receives the correct listing context.</p>
      <h2 className="mt-6 text-xl font-semibold">Safety</h2>
      <p className="mt-2">Alberta-Cars does not take payment for vehicles and does not inspect, own, broker, or guarantee vehicles. Independently verify identity, ownership, liens, condition, history, and payment before completing a transaction.</p>
    </article>
  );
}
