import type { Metadata } from "next";
import { ListingEditForm } from "@/components/listing-edit-form";
import { E2E_HARNESS_LISTING_ID, requireE2eHarness } from "@/lib/e2e-harness";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit form (test harness)", robots: { index: false, follow: false } };

export default function EditFormHarness() {
  requireE2eHarness();
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">2019 Toyota RAV4</h1>
      <details open className="mt-6 rounded-card border border-line bg-surface p-4">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-ink">Edit listing</summary>
        <ListingEditForm
          listingId={E2E_HARNESS_LISTING_ID}
          initial={{
            make: "Toyota",
            model: "RAV4",
            year: 2019,
            price: 28500,
            mileage: 64000,
            fuel: "Gasoline",
            bodyType: "SUV",
            transmission: "Automatic",
            drivetrain: "AWD",
            city: "Calgary",
            color: "Silver",
            engineL: 2.5,
            powerHp: 203,
            features: ["heated_seats"],
            description: "One owner, winter tires included.",
          }}
        />
      </details>
    </div>
  );
}
