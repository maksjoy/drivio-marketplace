import type { Metadata } from "next";
import { MyListingRow } from "@/components/my-listing-row";
import { requireE2eHarness } from "@/lib/e2e-harness";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My listings (test harness)", robots: { index: false, follow: false } };

const LISTINGS = [
  { id: "00000000-0000-4000-8000-0000000000a1", make: "Honda", model: "Civic", year: 2017, price: 14900, status: "active" },
  { id: "00000000-0000-4000-8000-0000000000a2", make: "Toyota", model: "RAV4", year: 2019, price: 28500, status: "pending" },
  { id: "00000000-0000-4000-8000-0000000000a3", make: "Ford", model: "F-150", year: 2015, price: 21000, status: "sold" },
];

/** The /account "My listings" rows with fixture data (the real page needs a Supabase session). */
export default function AccountListingsHarness() {
  requireE2eHarness();
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-xl font-semibold">My listings</h1>
      <div className="space-y-3">
        {LISTINGS.map((listing) => <MyListingRow key={listing.id} listing={listing} />)}
      </div>
    </div>
  );
}
