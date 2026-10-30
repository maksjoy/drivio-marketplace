import type { Metadata } from "next";
import Link from "next/link";
import { EditHashRedirect } from "@/components/edit-hash-redirect";
import { EditListingLink } from "@/components/edit-listing-link";
import { EditListingScreen, type EditListingData } from "@/components/edit-listing-screen";
import { E2E_HARNESS_LISTING_ID, requireE2eHarness } from "@/lib/e2e-harness";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit listing — Alberta-Cars", robots: { index: false, follow: false } };

const DESCRIPTION = "One owner, non-smoker. Full Toyota service history, new brakes in 2025. Winter tires on rims included. Small chip on the windshield, otherwise clean. Selling because we moved to an EV.";

const FIXTURE: EditListingData = {
  id: E2E_HARNESS_LISTING_ID,
  year: 2019,
  make: "Toyota",
  model: "RAV4",
  price: 28500,
  mileage: 84200,
  fuel: "Gasoline",
  bodyType: "SUV",
  transmission: "Automatic",
  drivetrain: "AWD",
  city: "Calgary",
  color: "Silver",
  engineL: 2.5,
  powerHp: 203,
  features: ["heated_seats", "keyless_entry", "push_button_start", "backup_camera"],
  description: DESCRIPTION,
  status: "active",
  createdAt: "2026-10-02T12:00:00.000Z",
  soldAt: null,
  coverUrl: null,
};

/**
 * The edit page without a Supabase session.
 * ?panel=closed is the listing-page stand-in (Edit listing link, Manage listing, #edit redirect).
 * ?state=sold renders the locked sold state.
 */
export default async function EditFormHarness({ searchParams }: { searchParams: Promise<{ panel?: string; state?: string }> }) {
  requireE2eHarness();
  const { panel, state } = await searchParams;
  if (panel === "closed") {
    return (
      <div>
        <h1 className="text-2xl font-semibold">2019 Toyota RAV4</h1>
        <EditHashRedirect listingId={E2E_HARNESS_LISTING_ID} enabled />
        <EditListingLink listingId={E2E_HARNESS_LISTING_ID} />
        <section aria-label="Listing details" className="mt-6 min-h-[150vh] border-t border-line pt-5 text-muted">Specs and seller description.</section>
        <div className="mt-4 flex gap-2">
          <Link href={`/listings/${E2E_HARNESS_LISTING_ID}/edit`} className="inline-flex min-h-11 items-center rounded-full border border-line-strong bg-surface px-5 text-sm font-bold text-ink hover:bg-surface-sunken">Manage listing</Link>
        </div>
      </div>
    );
  }
  const listing = state === "sold"
    ? { ...FIXTURE, status: "sold", soldAt: "2026-10-21T12:00:00.000Z" }
    : FIXTURE;
  return <EditListingScreen listing={listing} />;
}
