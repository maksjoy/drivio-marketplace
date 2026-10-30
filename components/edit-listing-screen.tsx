import Link from "next/link";
import { formatMileageKm, formatPriceCAD } from "@/lib/listings";
import { EditBackLink, EditLeaveGuard } from "@/components/edit-leave-guard";
import { ListingEditForm } from "@/components/listing-edit-form";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";

export type EditListingData = {
  id: string;
  year: number;
  make: string;
  model: string;
  price: number;
  mileage: number;
  fuel: string;
  bodyType: string | null;
  transmission: string | null;
  drivetrain: string | null;
  city: string | null;
  color: string | null;
  engineL: number | string | null;
  powerHp: number | null;
  features: string[];
  description: string | null;
  status: string;
  createdAt: string | null;
  soldAt: string | null;
  coverUrl: string | null;
};

const STATUS_PILL: Record<string, { label: string; wrap: string; dot: string }> = {
  active: { label: "Live", wrap: "bg-success-soft text-success", dot: "bg-success" },
  pending: { label: "In review", wrap: "bg-primary-soft text-primary-strong", dot: "bg-primary" },
  rejected: { label: "Not approved", wrap: "bg-danger-soft text-danger", dot: "bg-danger" },
};

export function EditListingScreen({ listing }: { listing: EditListingData }) {
  const title = `${listing.year} ${listing.make} ${listing.model}`;
  const sold = listing.status === "sold";
  return (
    <EditLeaveGuard>
    <div data-edit-page className="lg:grid lg:grid-cols-[minmax(0,720px)_300px] lg:items-start lg:gap-12">
      <div className="mx-auto w-full max-w-[720px] lg:mx-0">
        <EditBackLink href={`/listings/${listing.id}`} className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-[15px] font-medium text-primary hover:bg-primary-soft">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
          Back to listing
        </EditBackLink>
        <h1 className="mt-1 text-[26px] font-semibold leading-tight tracking-tight text-ink sm:text-3xl">Edit listing</h1>
        <p className="mt-1 text-[15px] text-muted">{title} · {formatPriceCAD(listing.price)}</p>
        {sold ? <SoldCard soldAt={listing.soldAt} /> : (
          <>
            <Notice variant="info" className="mt-4 flex gap-3">
              <span className="mt-0.5 text-primary" aria-hidden="true">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
              </span>
              <span>Saving changes sends this listing back to review.</span>
            </Notice>
            <ListingEditForm
              listingId={listing.id}
              initial={{
                make: listing.make,
                model: listing.model,
                year: listing.year,
                price: listing.price,
                mileage: listing.mileage,
                fuel: listing.fuel,
                bodyType: listing.bodyType,
                transmission: listing.transmission,
                drivetrain: listing.drivetrain,
                city: listing.city,
                color: listing.color,
                engineL: listing.engineL,
                powerHp: listing.powerHp,
                features: listing.features,
                description: listing.description,
              }}
            />
          </>
        )}
      </div>
      {!sold && <ListingSummary listing={listing} title={title} />}
    </div>
    </EditLeaveGuard>
  );
}

function SoldCard({ soldAt }: { soldAt: string | null }) {
  const soldOn = formatMediumDate(soldAt);
  return (
    <Card className="mt-4 p-5">
      <div role="status">
        <div className="flex gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-ink-soft" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
          </span>
          <div>
            <p className="text-base font-semibold text-ink">Sold listings can&apos;t be edited</p>
            <p className="mt-1 text-sm leading-6 text-muted">
              {soldOn
                ? `You marked this car as sold on ${soldOn}. Buyers no longer see it in search.`
                : "You marked this car as sold. Buyers no longer see it in search."}
            </p>
          </div>
        </div>
        <ButtonLink href="/account" variant="primary" size="lg" className="mt-4 w-full sm:w-auto">Back to my listings</ButtonLink>
      </div>
    </Card>
  );
}

function ListingSummary({ listing, title }: { listing: EditListingData; title: string }) {
  const pill = STATUS_PILL[listing.status];
  const listed = formatMediumDate(listing.createdAt);
  const facts = [formatMileageKm(listing.mileage), listing.transmission, listing.drivetrain].filter(Boolean).join(" · ");
  return (
    <aside aria-label="Listing summary" className="hidden self-start lg:sticky lg:top-24 lg:block">
      <Card className="p-4">
        <div className="overflow-hidden rounded-control bg-primary-soft">
          {listing.coverUrl ? (
            <img src={listing.coverUrl} alt="" className="aspect-[16/10] w-full object-cover" />
          ) : (
            <div className="flex aspect-[16/10] items-center justify-center text-primary" aria-hidden="true">
              <CarMark />
            </div>
          )}
        </div>
        <p className="mt-3 text-[15px] font-semibold text-ink">{title}</p>
        <p className="text-xl font-bold text-ink">{formatPriceCAD(listing.price)}</p>
        {facts && <p className="mt-1 text-sm text-muted">{facts}</p>}
        {(pill || listed) && (
          <div className="mt-3 flex items-center gap-2">
            {pill && (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${pill.wrap}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${pill.dot}`} aria-hidden="true" />
                {pill.label}
              </span>
            )}
            {listed && <span className="text-xs text-muted">Listed {listed}</span>}
          </div>
        )}
        <Link href={`/listings/${listing.id}`} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">View listing</Link>
      </Card>
    </aside>
  );
}

function formatMediumDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

function CarMark() {
  return (
    <svg viewBox="0 0 200 96" className="h-[4.5rem] w-40" fill="none" aria-hidden="true">
      <path className="fill-primary-muted" d="M22 68h156a6 6 0 0 0 6-6v-4c0-5-4-9-12-11l-26-12c-8-4-18-8-32-8H86c-12 0-22 4-30 12L40 55c-6 5-12 9-12 15v-2Z" />
      <path className="fill-surface" d="M92 33h34l12 16H80l12-16Z" />
      <circle className="fill-ink" cx="62" cy="70" r="10" />
      <circle className="fill-surface" cx="62" cy="70" r="4" />
      <circle className="fill-ink" cx="148" cy="70" r="10" />
      <circle className="fill-surface" cx="148" cy="70" r="4" />
    </svg>
  );
}
