"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { albertaCities, formatMileageKm, formatPriceCAD } from "@/lib/listings";
import { createClient } from "@/lib/supabase/client";
import { Filters } from "@/components/filters";
import { FavoriteButton } from "@/components/favorite-button";

type Listing = {
  id: string;
  make: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  city: string | null;
  images: string[];
};

export function HomeClient() {
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [signedIn, setSignedIn] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const page = Math.max(1, Number(searchParams.get("page") || "1") || 1);
  const pageSize = 24;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/listings${queryString ? `?${queryString}` : ""}`, {
          cache: "no-store",
        });
        const body = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(body.error || "Could not load listings.");
        }

        const nextListings: Listing[] = body.listings ?? [];
        if (cancelled) return;

        setListings(nextListings);
        setTotal(body.total ?? 0);

        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (cancelled) return;
        setSignedIn(Boolean(user));

        if (user && nextListings.length > 0) {
          const { data: favorites } = await supabase
            .from("favorites")
            .select("listing_id")
            .eq("user_id", user.id)
            .in("listing_id", nextListings.map((listing) => listing.id));

          if (!cancelled) {
            setFavoriteIds(new Set((favorites ?? []).map((favorite) => favorite.listing_id)));
          }
        } else {
          setFavoriteIds(new Set());
        }
      } catch (err) {
        if (!cancelled) {
          setListings([]);
          setTotal(0);
          setError(err instanceof Error ? err.message : "Could not load listings.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [queryString]);

  const hasNext = useMemo(() => page * pageSize < total, [page, total]);

  return (
    <div>
      <section className="mb-8">
        <h1 className="text-3xl font-semibold">Used cars in Alberta, straight from the owner</h1>
        <p className="mt-2 max-w-2xl text-prairie-600">
          Private listings from Calgary, Edmonton, Red Deer and across Alberta — without dealer inventory mixed in.
        </p>
      </section>

      <Filters cities={albertaCities} />

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">Could not load listings</p>
          <p className="mt-1 break-words">{error}</p>
        </div>
      )}

      <p className="mb-4 mt-6 text-sm text-prairie-600">
        {loading ? "Loading listings…" : `${total} listings`}
      </p>

      {!loading && !error && listings.length === 0 ? (
        <p className="py-12 text-center text-prairie-600">
          No listings yet. Be the first to post a car.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <article
              key={listing.id}
              className="relative overflow-hidden rounded-2xl border border-prairie-200 bg-white transition-shadow hover:shadow-md"
            >
              <div className="absolute right-3 top-3 z-10">
                <FavoriteButton
                  listingId={listing.id}
                  initialFavorite={favoriteIds.has(listing.id)}
                  signedIn={signedIn}
                  compact
                />
              </div>

              <Link href={`/listings/${listing.id}`} className="group block">
                <div className="aspect-[4/3] overflow-hidden bg-prairie-100">
                  {listing.images?.[0] ? (
                    <img
                      src={listing.images[0]}
                      alt={`${listing.year} ${listing.make} ${listing.model}`}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-prairie-400">
                      No photo
                    </div>
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
          ))}
        </div>
      )}

      {!loading && !error && total > pageSize && (
        <div className="mt-8 flex justify-center gap-3 text-sm">
          {page > 1 && <Link className="underline" href={withPage(searchParams, page - 1)}>← Previous</Link>}
          {hasNext && <Link className="underline" href={withPage(searchParams, page + 1)}>Next →</Link>}
        </div>
      )}
    </div>
  );
}

function withPage(searchParams: URLSearchParams | ReadonlyURLSearchParamsLike, page: number) {
  const params = new URLSearchParams(searchParams.toString());
  params.set("page", String(page));
  return `/?${params.toString()}`;
}

type ReadonlyURLSearchParamsLike = {
  toString(): string;
};
