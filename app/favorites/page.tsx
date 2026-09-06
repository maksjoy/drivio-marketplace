import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMileageKm, formatPriceCAD } from "@/lib/listings";
import { FavoriteButton } from "@/components/favorite-button";

export const revalidate = 0;

export default async function FavoritesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: favorites, error } = await supabase
    .from("favorites")
    .select("listing_id, created_at, listings(*, listing_images(storage_path, position))")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const listings = (favorites ?? [])
    .map((favorite: any) => favorite.listings)
    .filter((listing: any) => listing && listing.status === "active");

  return (
    <div>
      <h1 className="text-2xl font-semibold">Favorites</h1>
      <p className="mt-1 text-sm text-prairie-600">Cars you saved for later.</p>

      {error ? (
        <p className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">Could not load favorites.</p>
      ) : listings.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-prairie-300 bg-white p-8 text-center">
          <p className="text-prairie-600">You haven't saved any cars yet.</p>
          <Link href="/" className="mt-4 inline-block rounded-full bg-rig-700 px-5 py-2 text-sm text-white">Browse cars</Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing: any) => {
            const firstImage = (listing.listing_images ?? []).slice().sort((a: any, b: any) => a.position - b.position)[0];
            const imageUrl = firstImage
              ? supabase.storage.from("listing-photos").getPublicUrl(firstImage.storage_path).data.publicUrl
              : null;

            return (
              <article key={listing.id} className="relative overflow-hidden rounded-2xl border border-prairie-200 bg-white">
                <div className="absolute right-3 top-3 z-10">
                  <FavoriteButton listingId={listing.id} initialFavorite signedIn compact />
                </div>
                <Link href={`/listings/${listing.id}`} className="block">
                  <div className="aspect-[4/3] bg-prairie-100">
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageUrl} alt={`${listing.year} ${listing.make} ${listing.model}`} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="p-4">
                    <p className="font-semibold">{listing.year} {listing.make} {listing.model}</p>
                    <p className="text-lg font-semibold text-rig-700">{formatPriceCAD(listing.price)}</p>
                    <p className="text-sm text-prairie-600">{formatMileageKm(listing.mileage)}{listing.city ? ` · ${listing.city}` : ""}</p>
                  </div>
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
