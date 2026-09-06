import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { formatMileageKm, formatPriceCAD } from "@/lib/listings";
import { FavoriteButton } from "@/components/favorite-button";

export const revalidate = 0;

type PageContext = { params: Promise<{ id: string }> };

async function getListing(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select("*, listing_images(storage_path, position)")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (data.status !== "active" && data.user_id !== user?.id) return null;

  const images = (data.listing_images ?? [])
    .slice()
    .sort((a: any, b: any) => a.position - b.position)
    .map((img: any) => supabase.storage.from("listing-photos").getPublicUrl(img.storage_path).data.publicUrl);

  let isFavorite = false;
  if (user && data.status === "active") {
    const { data: favorite } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", user.id)
      .eq("listing_id", data.id)
      .maybeSingle();
    isFavorite = Boolean(favorite);
  }

  return { ...data, images, isOwner: data.user_id === user?.id, signedIn: Boolean(user), isFavorite };
}

export async function generateMetadata(context: PageContext): Promise<Metadata> {
  const { id } = await context.params;
  const listing = await getListing(id);
  if (!listing) return { title: "Listing not found — AlbertaCars" };

  const title = `${listing.year} ${listing.make} ${listing.model} — ${formatPriceCAD(listing.price)} | AlbertaCars`;
  const location = listing.city ? `${listing.city}, AB` : "Alberta";
  const text = listing.description?.trim() || "Private used vehicle listing in Alberta.";
  const description = `${formatMileageKm(listing.mileage)} · ${location}. ${text.slice(0, 140)}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: listing.images[0] ? [listing.images[0]] : [],
    },
  };
}

export default async function ListingPage(context: PageContext) {
  const { id } = await context.params;
  const listing = await getListing(id);
  if (!listing) notFound();

  const telegramUser = listing.seller_telegram?.trim().replace(/^@/, "");

  return (
    <article className="grid gap-8 md:grid-cols-2">
      <div>
        <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-prairie-100">
          {listing.images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={listing.images[0]} alt={`${listing.year} ${listing.make} ${listing.model}`} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-prairie-500">No photo</div>
          )}
        </div>
        {listing.images.length > 1 && (
          <div className="mt-3 grid grid-cols-4 gap-2">
            {listing.images.slice(1).map((src: string) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt="" className="aspect-square rounded-lg object-cover" />
            ))}
          </div>
        )}
      </div>

      <div>
        {listing.status !== "active" && (
          <p className="mb-3 inline-block rounded-full bg-prairie-200 px-3 py-1 text-xs uppercase tracking-wide">
            {listing.status === "pending" ? "Pending review — only you can see this" : listing.status}
          </p>
        )}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{listing.year} {listing.make} {listing.model}</h1>
            <p className="mt-1 text-2xl font-semibold text-rig-700">{formatPriceCAD(listing.price)}</p>
          </div>
          {listing.status === "active" && (
            <FavoriteButton listingId={listing.id} initialFavorite={listing.isFavorite} signedIn={listing.signedIn} />
          )}
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
          <div className="mt-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-prairie-500">Features</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {listing.features.map((feature: string) => (
                <li key={feature} className="rounded-full bg-prairie-100 px-3 py-1 text-xs">{feature}</li>
              ))}
            </ul>
          </div>
        )}

        {listing.description && (
          <div className="mt-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-prairie-500">Description</h2>
            <p className="mt-2 whitespace-pre-line text-prairie-800">{listing.description}</p>
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-prairie-200 bg-white p-4">
          <p className="mb-3 text-sm text-prairie-500">Contact {listing.seller_name}</p>
          <div className="flex flex-wrap gap-2">
            {listing.seller_phone && (
              <a href={`tel:${listing.seller_phone}`} className="rounded-full border border-prairie-300 px-4 py-2 text-sm font-medium">Call {listing.seller_phone}</a>
            )}
            {listing.seller_email && (
              <a href={`mailto:${listing.seller_email}`} className="rounded-full border border-prairie-300 px-4 py-2 text-sm font-medium">Email seller</a>
            )}
            {telegramUser && (
              <a href={`https://t.me/${encodeURIComponent(telegramUser)}`} target="_blank" rel="noreferrer" className="rounded-full border border-prairie-300 px-4 py-2 text-sm font-medium">Telegram @{telegramUser}</a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
