import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { formatMileageKm, formatPriceCAD } from "@/lib/listings";
import { FavoriteButton } from "@/components/favorite-button";
import { ShareButton } from "@/components/share-button";

export const revalidate = 0;
type PageContext = { params: Promise<{ id: string }> };

async function getListing(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select("*, listing_images(storage_path, thumb_path, position)")
    .eq("id", id)
    .single();
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
  return {
    title,
    description,
    alternates: { canonical: `https://p2pcars.ca/listings/${listing.id}` },
    openGraph: { title, description, url: `https://p2pcars.ca/listings/${listing.id}`, images: listing.images[0] ? [listing.images[0]] : [] },
  };
}

export default async function ListingPage(context: PageContext) {
  const { id } = await context.params;
  const listing = await getListing(id);
  if (!listing) notFound();
  const publicListing = ["active", "sold"].includes(listing.status);

  return (
    <article className="grid gap-8 md:grid-cols-2">
      <div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-prairie-100">
          {listing.status === "sold" && <span className="absolute left-4 top-4 z-10 rounded-full bg-slate-950/90 px-4 py-2 text-sm font-bold text-white">SOLD</span>}
          {listing.images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={listing.images[0]} alt={`${listing.year} ${listing.make} ${listing.model}`} className="h-full w-full object-cover" />
          ) : <div className="flex h-full items-center justify-center text-prairie-500">Photo unavailable</div>}
        </div>
        {listing.images.length > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
            {listing.images.slice(1).map((src: string, index: number) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={`${src}-${index}`} src={src} alt={`Vehicle photo ${index + 2}`} className="h-24 w-32 flex-none rounded-lg object-cover" />
            ))}
          </div>
        )}
      </div>

      <div>
        {!publicListing && (
          <p className="mb-3 inline-block rounded-full bg-prairie-200 px-3 py-1 text-xs uppercase tracking-wide">
            {listing.status === "pending" ? "Pending review — only you can see this" : listing.status}
          </p>
        )}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{listing.year} {listing.make} {listing.model}</h1>
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

        {listing.features?.length > 0 && (
          <div className="mt-5"><h2 className="text-sm font-semibold uppercase tracking-wide text-prairie-500">Features</h2>
            <ul className="mt-2 flex flex-wrap gap-2">{listing.features.map((feature: string) => <li key={feature} className="rounded-full bg-prairie-100 px-3 py-1 text-xs">{feature}</li>)}</ul>
          </div>
        )}
        {listing.description && <div className="mt-5"><h2 className="text-sm font-semibold uppercase tracking-wide text-prairie-500">Description</h2><p className="mt-2 whitespace-pre-line text-prairie-800">{listing.description}</p></div>}

        <div className="mt-6 flex flex-wrap gap-2">
          <ShareButton title={`${listing.year} ${listing.make} ${listing.model}`} />
          {listing.isOwner && <a href="/account" className="rounded-full border border-prairie-300 bg-white px-4 py-2 text-sm font-medium">Manage listing</a>}
        </div>

        {listing.status === "active" && !listing.isOwner && (
          <div className="mt-6 rounded-2xl border border-prairie-200 bg-white p-4">
            <p className="mb-3 text-sm text-prairie-500">Contact {listing.seller_name}</p>
            <div className="flex flex-wrap gap-2">
              {listing.seller_phone && <a href={`tel:${listing.seller_phone.replace(/[^+0-9]/g, "")}`} className="rounded-full border border-prairie-300 px-4 py-2 text-sm font-medium">Call seller</a>}
              {listing.seller_email && <a href={`mailto:${listing.seller_email}`} className="rounded-full border border-prairie-300 px-4 py-2 text-sm font-medium">Email seller</a>}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
