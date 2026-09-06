import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { albertaCities, formatMileageKm, formatPriceCAD, parseOptionalInt } from "@/lib/listings";
import { Filters } from "@/components/filters";
import { FavoriteButton } from "@/components/favorite-button";

export const revalidate = 0;

type SearchParams = {
  city?: string;
  make?: string;
  model?: string;
  priceMin?: string;
  priceMax?: string;
  yearMin?: string;
  yearMax?: string;
  mileageMax?: string;
  fuel?: string;
  bodyType?: string;
  transmission?: string;
  drivetrain?: string;
  page?: string;
};

export default async function HomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const page = Math.max(1, parseOptionalInt(params.page) ?? 1);
  const pageSize = 24;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let supabase: Awaited<ReturnType<typeof createClient>> | null = null;
  let user: any = null;
  let listings: any[] = [];
  let count = 0;
  let loadError: string | null = null;
  let favoriteIds = new Set<string>();

  try {
    supabase = await createClient();

    const authResult = await supabase.auth.getUser();
    user = authResult.data.user;

    let query = supabase
      .from("listings")
      .select("*, listing_images(storage_path, position)", { count: "exact" })
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (params.city?.trim()) query = query.eq("city", params.city.trim());
    if (params.make?.trim()) query = query.eq("make", params.make.trim());
    if (params.model?.trim()) query = query.eq("model", params.model.trim());
    if (params.fuel?.trim()) query = query.eq("fuel", params.fuel.trim());
    if (params.bodyType?.trim()) query = query.eq("body_type", params.bodyType.trim());
    if (params.transmission?.trim()) query = query.eq("transmission", params.transmission.trim());
    if (params.drivetrain?.trim()) query = query.eq("drivetrain", params.drivetrain.trim());

    const priceMin = parseOptionalInt(params.priceMin);
    const priceMax = parseOptionalInt(params.priceMax);
    const yearMin = parseOptionalInt(params.yearMin);
    const yearMax = parseOptionalInt(params.yearMax);
    const mileageMax = parseOptionalInt(params.mileageMax);

    if (priceMin !== null && priceMin >= 0) query = query.gte("price", priceMin);
    if (priceMax !== null && priceMax >= 0) query = query.lte("price", priceMax);
    if (yearMin !== null && yearMin >= 1980) query = query.gte("year", yearMin);
    if (yearMax !== null && yearMax >= 1980) query = query.lte("year", yearMax);
    if (mileageMax !== null && mileageMax >= 0) query = query.lte("mileage", mileageMax);

    const result = await query;
    if (result.error) {
      loadError = result.error.message;
    } else {
      listings = result.data ?? [];
      count = result.count ?? 0;
    }

    if (user && listings.length > 0) {
      const favoritesResult = await supabase
        .from("favorites")
        .select("listing_id")
        .eq("user_id", user.id)
        .in("listing_id", listings.map((listing: any) => listing.id));

      favoriteIds = new Set((favoritesResult.data ?? []).map((favorite) => favorite.listing_id));
    }
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unknown server error";
    console.error("Homepage Supabase initialization failed", error);
  }

  return (
    <div>
      <section className="mb-8">
        <h1 className="text-3xl font-semibold">Used cars in Alberta, straight from the owner</h1>
        <p className="mt-2 max-w-2xl text-prairie-600">
          Private listings from Calgary, Edmonton, Red Deer and across Alberta — without dealer inventory mixed in.
        </p>
      </section>

      <Filters cities={albertaCities} />

      {loadError ? (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">Database connection error</p>
          <p className="mt-1 break-words">{loadError}</p>
        </div>
      ) : (
        <>
          <p className="mb-4 mt-6 text-sm text-prairie-600">{count} listings</p>

          {listings.length === 0 ? (
            <p className="py-12 text-center text-prairie-600">
              No listings yet. Be the first to post a car.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((listing: any) => {
                const firstImage = (listing.listing_images ?? []).slice().sort(
                  (a: any, b: any) => a.position - b.position,
                )[0];
                const imageUrl = firstImage && supabase
                  ? supabase.storage.from("listing-photos").getPublicUrl(firstImage.storage_path).data.publicUrl
                  : null;

                return (
                  <article
                    key={listing.id}
                    className="relative overflow-hidden rounded-2xl border border-prairie-200 bg-white transition-shadow hover:shadow-md"
                  >
                    <div className="absolute right-3 top-3 z-10">
                      <FavoriteButton
                        listingId={listing.id}
                        initialFavorite={favoriteIds.has(listing.id)}
                        signedIn={Boolean(user)}
                        compact
                      />
                    </div>
                    <Link href={`/listings/${listing.id}`} className="group block">
                      <div className="aspect-[4/3] overflow-hidden bg-prairie-100">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={`${listing.year} ${listing.make} ${listing.model}`}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm text-prairie-400">No photo</div>
                        )}
                      </div>
                      <div className="p-4">
                        <p className="font-semibold">{listing.year} {listing.make} {listing.model}</p>
                        <p className="text-lg font-semibold text-rig-700">{formatPriceCAD(listing.price)}</p>
                        <p className="text-sm text-prairie-600">
                          {formatMileageKm(listing.mileage)}{listing.city ? ` · ${listing.city}` : ""}
                        </p>
                      </div>
                    </Link>
                  </article>
                );
              })}
            </div>
          )}

          {count > pageSize && (
            <div className="mt-8 flex justify-center gap-3 text-sm">
              {page > 1 && <Link className="underline" href={`/?${toQuery(params, page - 1)}`}>← Previous</Link>}
              {to + 1 < count && <Link className="underline" href={`/?${toQuery(params, page + 1)}`}>Next →</Link>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function toQuery(params: SearchParams, page: number) {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key !== "page" && value) usp.set(key, value);
  }
  usp.set("page", String(page));
  return usp.toString();
}
