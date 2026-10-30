import Link from "next/link";

/** Owner shortcut on the listing page. The whole row is the link; both lines are its name. */
export function EditListingLink({ listingId }: { listingId: string }) {
  return (
    <Link
      href={`/listings/${listingId}/edit`}
      className="mt-6 flex min-h-11 items-center justify-between gap-3 rounded-card border border-line bg-surface p-4 text-ink hover:bg-surface-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span className="flex min-w-0 flex-col">
        <span className="font-semibold">Edit listing</span>
        <span className="text-sm text-muted">Change price, photos or details</span>
      </span>
      <svg viewBox="0 0 24 24" className="h-5 w-5 flex-none text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
    </Link>
  );
}
