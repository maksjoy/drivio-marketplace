import type { Metadata } from "next";
import { ListingEditForm } from "@/components/listing-edit-form";
import { EditListingPanel } from "@/components/edit-listing-panel";
import { buttonClasses } from "@/components/ui/button";
import { E2E_HARNESS_LISTING_ID, requireE2eHarness } from "@/lib/e2e-harness";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit form (test harness)", robots: { index: false, follow: false } };

// ?panel=closed renders the panel collapsed, as the real listing page does, to test #edit.
export default async function EditFormHarness({ searchParams }: { searchParams: Promise<{ panel?: string }> }) {
  requireE2eHarness();
  const { panel } = await searchParams;
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">2019 Toyota RAV4</h1>
      <EditListingPanel defaultOpen={panel !== "closed"}>
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
      </EditListingPanel>
      {/* Stand-in for the specs and description, so the owner link below sits a long scroll away. */}
      <section aria-label="Listing details" className="mt-6 min-h-[150vh] border-t border-line pt-5 text-muted">Specs and seller description.</section>
      <div className="mt-4 flex gap-2"><a href="#edit" className={buttonClasses("secondary", "sm", "!rounded-full !px-4")}>Manage listing</a></div>
    </div>
  );
}
