import Link from "next/link";
import { formatPriceCAD } from "@/lib/listings";
import { MyListingActions } from "@/components/my-listing-actions";

export type MyListingRowData = { id: string; make: string; model: string; year: number; price: number; status: string };

/** One row of "My listings" on /account (also rendered by the e2e harness). */
export function MyListingRow({ listing }: { listing: MyListingRowData }) {
  const title = `${listing.year} ${listing.make} ${listing.model}`;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <Link href={`/listings/${listing.id}`} className="min-w-0 hover:text-primary">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted">{formatPriceCAD(listing.price)} · <span className="text-xs uppercase tracking-wide">{listing.status}</span></p>
      </Link>
      <MyListingActions listingId={listing.id} status={listing.status} title={title} />
    </div>
  );
}
