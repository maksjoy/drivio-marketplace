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

  return (
    <article className="grid w-full min-w-0 max-w-full gap-8 overflow-x-hidden md:grid-cols-2">
      <ListingGallery images={listing.images} alt={vehicleTitle} sold={listing.status === "sold"} />

      <div className="min-w-0 max-w-full">
        {!publicListing && <p className="mb-3 inline-block rounded-full bg-prairie-200 px-3 py-1 text-xs uppercase tracking-wide">{listing.status === "pending" ? "Pending review — only you can see this" : listing.status}</p>}
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-semibold">{vehicleTitle}</h1>
            <p className="mt-1 text-2xl font-semibold text-rig-700">{formatPriceCAD(listing.price)}</p>
          </div>
          {publicListing && <FavoriteButton listingId={listing.id} initialFavorite={listing.isFavorite} signedIn={listing.signedIn} />}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm text-prairie-700">
          <dt className="text-prairie-500">Mileage</dt><dd>{formatMileageKm(listing.mileage)}</dd>
          <dt className="text-prairie-500">Fuel</dt><dd>{listing.fuel}</dd>
          {listing.city && <><dt className="text-prairie-500">Location</dt><dd>{listing.city}, AB</dd></>}
          {listing.body_type && <><dt className="text-prairie-500">Body</dt><dd>{listing.body_type}</dd></>}
          {listing.transmission && <><dt className="text-prairie-500">Transmission</dt><dd>{listing.transmission}</dd></>}
          {listing.drivetrain && <><dt className="text-prairie-500">Drivetrain</dt><dd>{listing.drivetrain}</dd></>}
          {listing.color && <><dt className="text-prairie-500">Colour</dt><dd>{listing.color}</dd></>}
          {listing.engine && <><dt className="text-prairie-500">Engine</dt><dd>{listing.engine}</dd></>}
        </dl>

        {listing.features?.length > 0 && <div className="mt-5"><h2 className="text-sm font-semibold uppercase tracking-wide text-prairie-500">Features</h2><ul className="mt-2 flex flex-wrap gap-2">{listing.features.map((feature: string) => <li key={feature} className="rounded-full bg-prairie-100 px-3 py-1 text-xs">{feature}</li>)}</ul></div>}
        {listing.description && <div className="mt-5"><h2 className="text-sm font-semibold uppercase tracking-wide text-prairie-500">Description</h2><p className="mt-2 whitespace-pre-line break-words text-prairie-800">{listing.description}</p></div>}

        <div className="mt-6 flex flex-wrap gap-2">
          <ShareButton title={vehicleTitle} />
          {listing.status === "active" && !listing.isOwner && <ReportButton listingId={listing.id} signedIn={listing.signedIn} />}
          {listing.isOwner && <a href="/account" className="rounded-full border border-prairie-300 bg-white px-4 py-2 text-sm font-medium">Manage listing</a>}
        </div>

        {listing.status === "active" && !listing.isOwner && (
          <div className="mt-6 max-w-full rounded-2xl border border-prairie-200 bg-white p-4">
            <p className="mb-3 break-words text-sm text-prairie-500">Contact {listing.seller_name}</p>
            <div className="flex flex-wrap gap-2">
              {listing.seller_phone && <a href={`tel:${listing.seller_phone.replace(/[^+0-9]/g, "")}`} className="rounded-full border border-prairie-300 px-4 py-2 text-sm font-medium">Call seller</a>}
              {listing.seller_email && <a href={`mailto:${listing.seller_email}`} className="max-w-full break-all rounded-full border border-prairie-300 px-4 py-2 text-sm font-medium">Email seller</a>}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
