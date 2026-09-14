import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { formatMileageKm, formatPriceCAD } from "@/lib/listings";
import { SITE_URL } from "@/lib/site-url";
import { FavoriteButton } from "@/components/favorite-button";
import { ReportButton } from "@/components/report-button";
import { ShareButton } from "@/components/share-button";
import { ListingGallery } from "@/components/listing-gallery";

export const revalidate = 0;
type PageContext = { params: Promise<{ id: string }> };

async function getListing(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("listings")
    .select("*, listing_images(storage_path, thumb_path, position)").eq("id", id).single();
  if (error || !data) return null;
  const { data: { user } } = await supabase.auth.getUser();
  const isOwner = data.user_id === user?.id;
  if (!["active", "sold"].includes(data.status) && !isOwner) return null;

  const imageRows = (data.listing_images ?? []).slice().sort((a: any, b: any) => a.position - b.position);
  const paths = imageRows.map((image: any) => image.storage_path).filter(Boolean);
  const { data: signed } = paths.length
    ? await supabase.storage.from("listing-photos").createSignedUrls(paths, 3600)
    : { data: [] as { signedUrl: string }[] };
  const images = (signed ?? []).map((item: any) => item.signedUrl).filter(Boolean);

  let isFavorite = false;
  if (user && ["active", "sold"].includes(data.status)) {
    const { data: favorite } = await supabase.from("favorites").select("listing_id")
      .eq("user_id", user.id).eq("listing_id", data.id).maybeSingle();
    isFavorite = Boolean(favorite);
  }
  return { ...data, images, isOwner, signedIn: Boolean(user), isFavorite };
}

export async function generateMetadata(context: PageContext): Promise<Metadata> {
  const { id } = await context.params;
  const listing = await getListing(id);
  if (!listing) return { title: "Listing not found — P2PCars.ca" };
  const title = `${listing.year} ${listing.make} ${listing.model} — ${formatPriceCAD(listing.price)} | P2PCars.ca`;
  const location = listing.city ? `${listing.city}, Alberta` : "Alberta";
  const text = listing.description?.trim() || "Private used vehicle listing in Alberta.";
  const description = `${formatMileageKm(listing.mileage)} · ${location}. ${text.slice(0, 140)}`;
  const canonical = `${SITE_URL}/listings/${listing.id}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, images: listing.images[0] ? [listing.images[0]] : [] },
  };
}

export default async function ListingPage(context: PageContext) {
  const { id } = await context.params;
  const listing = await getListing(id);
  if (!listing) notFound();
  const publicListing = ["active", "sold"].includes(listing.status);
  const vehicleTitle = `${listing.year} ${listing.make} ${listing.model}`;
  const phoneHref = listing.seller_phone ? `tel:${listing.seller_phone.replace(/[^+0-9]/g, "")}` : null;
  const emailHref = listing.seller_email ? `mailto:${listing.seller_email}` : null;
  const primaryContactHref = phoneHref || emailHref;
  const primaryContactLabel = phoneHref ? "Call seller" : "Email seller";

  return (
    <article className={`grid w-full min-w-0 max-w-full gap-6 overflow-x-hidden md:grid-cols-2 md:gap-10 ${listing.status === "active" && !listing.isOwner && primaryContactHref ? "pb-24 md:pb-0" : ""}`}>
      <ListingGallery images={listing.images} alt={vehicleTitle} sold={listing.status === "sold"} />

      <div className="min-w-0 max-w-full font-body">
        {!publicListing && (
          <p className="mb-4 inline-block rounded-full bg-prairie-200 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-700">
            {listing.status === "pending" ? "Pending review — only you can see this" : listing.status}
          </p>
        )}

        <div className="flex min-w-0 items-start justify-between gap-3 border-b border-prairie-200 pb-5">
          <div className="min-w-0">
            <h1 className="break-words font-body text-[28px] font-extrabold leading-tight text-slate-950 sm:text-3xl">
              {vehicleTitle}
            </h1>
            <p className="mt-3 text-[32px] font-extrabold leading-none text-emerald-600 sm:text-4xl">
              {formatPriceCAD(listing.price)}
            </p>
          </div>
          {publicListing && (
            <div className="flex-none rounded-full bg-white shadow-sm">
              <FavoriteButton listingId={listing.id} initialFavorite={listing.isFavorite} signedIn={listing.signedIn} />
            </div>
          )}
        </div>

        <div className="divide-y divide-prairie-100">
          <PrimarySpec icon="mileage" value={formatMileageKm(listing.mileage)} />
          <PrimarySpec icon="transmission" value={listing.transmission || "Transmission not specified"} />
          <PrimarySpec
            icon="fuel"
            value={[listing.fuel, listing.engine ? `${listing.engine} L` : null].filter(Boolean).join(" · ") || "Fuel not specified"}
          />
          <PrimarySpec icon="location" value={listing.city ? `${listing.city}, Alberta` : "Alberta"} />
        </div>

        {(listing.body_type || listing.drivetrain || listing.color) && (
          <div className="mt-2 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-3">
            {listing.body_type && <SecondarySpec label="Body" value={listing.body_type} />}
            {listing.drivetrain && <SecondarySpec label="Drivetrain" value={listing.drivetrain} />}
            {listing.color && <SecondarySpec label="Colour" value={listing.color} />}
          </div>
        )}

        {listing.features?.length > 0 && (
          <section className="mt-6 border-t border-prairie-200 pt-5">
            <h2 className="font-body text-lg font-extrabold text-slate-950">Features & equipment</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {listing.features.map((feature: string) => (
                <li key={feature} className="rounded-full bg-slate-100 px-3.5 py-2 text-sm font-semibold text-slate-700">
                  {feature}
                </li>
              ))}
            </ul>
          </section>
        )}

        {listing.description && (
          <section className="mt-6 border-t border-prairie-200 pt-5">
            <h2 className="font-body text-lg font-extrabold text-slate-950">Seller description</h2>
            <p className="mt-3 whitespace-pre-line break-words text-[17px] leading-7 text-slate-700">{listing.description}</p>
          </section>
        )}

        <div className="mt-6 border-t border-prairie-200 pt-4">
          <p className="text-sm font-medium text-prairie-500">{formatPublishedDate(listing.created_at)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <ShareButton title={vehicleTitle} />
            {listing.status === "active" && !listing.isOwner && <ReportButton listingId={listing.id} signedIn={listing.signedIn} />}
            {listing.isOwner && <a href="/account" className="rounded-full border-2 border-slate-900 bg-white px-5 py-2.5 text-sm font-bold text-slate-900">Manage listing</a>}
          </div>
        </div>

        {listing.status === "active" && !listing.isOwner && (
          <section className="mt-6 hidden rounded-2xl border border-prairie-200 bg-white p-5 shadow-sm md:block">
            <p className="text-sm font-semibold text-prairie-500">Private seller</p>
            <p className="mt-1 break-words text-lg font-extrabold text-slate-950">{listing.seller_name}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {phoneHref && <a href={phoneHref} className="rounded-full bg-emerald-600 px-6 py-3 text-base font-extrabold text-white hover:bg-emerald-700">Call seller</a>}
              {emailHref && <a href={emailHref} className="rounded-full border-2 border-slate-900 bg-white px-6 py-3 text-base font-extrabold text-slate-900">Email seller</a>}
            </div>
          </section>
        )}
      </div>

      {listing.status === "active" && !listing.isOwner && primaryContactHref && (
        <div className="fixed inset-x-0 bottom-[61px] z-30 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-md items-center gap-3">
            <a
              href={primaryContactHref}
              className="flex min-h-14 flex-1 items-center justify-center rounded-full bg-emerald-600 px-6 text-base font-extrabold text-white shadow-sm active:bg-emerald-700"
            >
              {primaryContactLabel}
            </a>
            <div className="flex h-14 w-14 flex-none items-center justify-center rounded-full border-2 border-slate-900 bg-white">
              <FavoriteButton listingId={listing.id} initialFavorite={listing.isFavorite} signedIn={listing.signedIn} compact />
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function PrimarySpec({ icon, value }: { icon: "mileage" | "fuel" | "transmission" | "location"; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-4 py-4 text-[17px] text-slate-800">
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-slate-100 text-slate-900" aria-hidden="true">
        {icon === "mileage" && (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M5 16a7 7 0 1 1 14 0" /><path d="m12 13 4-4" /><path d="M4 16h16" />
          </svg>
        )}
        {icon === "fuel" && (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M6 21V4h8v17" /><path d="M5 21h10" /><path d="M8 7h4" /><path d="M14 9h2l2 2v6a2 2 0 0 0 4 0v-6l-2-2" />
          </svg>
        )}
        {icon === "transmission" && (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="7" cy="6" r="2" /><circle cx="17" cy="6" r="2" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /><path d="M7 8v8M17 8v8M7 12h10" />
          </svg>
        )}
        {icon === "location" && (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" />
          </svg>
        )}
      </span>
      <span className="min-w-0 break-words font-semibold">{value}</span>
    </div>
  );
}

function SecondarySpec({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-bold uppercase tracking-wide text-prairie-500">{label}</p>
      <p className="mt-1 break-words font-bold text-slate-900">{value}</p>
    </div>
  );
}

function formatPublishedDate(value?: string | null) {
  if (!value) return "Recently published";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently published";
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
  if (days === 0) return "Published today";
  if (days === 1) return "Published yesterday";
  if (days < 7) return `Published ${days} days ago`;
  return `Published ${new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric" }).format(date)}`;
}
