import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMileageKm, formatPriceCAD } from "@/lib/listings";
import { FavoriteButton } from "@/components/favorite-button";
import { ButtonLink } from "@/components/ui/button";

export const revalidate = 0;
export const metadata = { title: "Saved cars — Alberta-Cars" };

export default async function FavoritesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Ffavorites");

  const { data: favorites, error } = await supabase.from("favorites")
    .select("listing_id, created_at, listings(id, make, model, year, price, mileage, city, status, listing_images(storage_path, thumb_path, position))")
    .eq("user_id", user.id).order("created_at", { ascending: false });

  const listings = (favorites ?? []).map((favorite: any) => favorite.listings)
    .filter((listing: any) => listing && ["active", "sold"].includes(listing.status));

  const cards = await Promise.all(listings.map(async (listing: any) => {
    const first = (listing.listing_images ?? []).slice().sort((a: any, b: any) => a.position - b.position)[0];
    let imageUrl: string | null = null;
    const path = first?.thumb_path || first?.storage_path;
    if (path) {
      const { data } = await supabase.storage.from("listing-photos").createSignedUrl(path, 3600);
      imageUrl = data?.signedUrl ?? null;
    }
    return { listing, imageUrl };
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold">Favorites</h1>
      <p className="mt-1 text-sm text-muted">Cars you saved for later.</p>
      {error ? (
        <p className="mt-6 rounded-xl bg-danger-soft p-4 text-sm text-danger">Could not load favorites.</p>
      ) : cards.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-line-strong bg-white p-8 text-center">
          <p className="text-muted">You haven't saved any cars yet.</p>
          <ButtonLink href="/" className="mt-4">Browse cars</ButtonLink>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(({ listing, imageUrl }) => (
            <article key={listing.id} className="relative overflow-hidden rounded-2xl border border-line bg-white">
              <div className="absolute right-3 top-3 z-10"><FavoriteButton listingId={listing.id} initialFavorite signedIn compact /></div>
              {listing.status === "sold" && <span className="absolute left-3 top-3 z-10 rounded-full bg-ink/90 px-3 py-1 text-xs font-bold text-white">SOLD</span>}
              <Link href={`/listings/${listing.id}`} className="block">
                <div className="aspect-[4/3] bg-surface-sunken">
                  {imageUrl ? <img src={imageUrl} alt={`${listing.year} ${listing.make} ${listing.model}`} width={1200} height={900} className="h-full w-full object-cover" /> : null}
                </div>
                <div className="p-4">
                  <p className="font-semibold">{listing.year} {listing.make} {listing.model}</p>
                  <p className="text-lg font-semibold text-primary">{formatPriceCAD(listing.price)}</p>
                  <p className="text-sm text-muted">{formatMileageKm(listing.mileage)}{listing.city ? ` · ${listing.city}` : ""}</p>
                </div>
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
