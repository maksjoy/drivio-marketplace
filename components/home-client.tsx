"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { albertaCities, formatMileageKm, formatPriceCAD } from "@/lib/listings";
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
  status: string;
  soldAt?: string | null;
  images: string[];
};

type CatalogPayload = {
  listings?: Listing[];
  hasMore?: boolean;
  nextCursor?: string | null;
  error?: string;
};

export function HomeClient() {
  const searchParams = useSearchParams();
  const normalizedParams = new URLSearchParams(searchParams.toString());
  normalizedParams.delete("page");
  normalizedParams.delete("cursor");
  const queryString = normalizedParams.toString();

  const [listings, setListings] = useState<Listing[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      setListings([]);
      setFavoriteIds(new Set());
      try {
        const response = await fetch(`/api/listings${queryString ? `?${queryString}` : ""}`);
        const body = await response.json().catch(() => ({})) as CatalogPayload;
        if (!response.ok) throw new Error(body.error || "Could not load listings.");
        if (cancelled) return;
        const firstPage = body.listings ?? [];
        setListings(firstPage);
        setNextCursor(body.nextCursor ?? null);
        setHasMore(Boolean(body.hasMore));
        await loadFavorites(firstPage.map((listing) => listing.id), cancelled);
      } catch (err) {
        if (!cancelled) {
          setListings([]);
          setHasMore(false);
          setNextCursor(null);
          setError(err instanceof Error ? err.message : "Could not load listings.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [queryString]);

  async function loadFavorites(ids: string[], cancelled = false) {
    if (!ids.length) return;
    try {
      const response = await fetch(`/api/favorites?listingIds=${encodeURIComponent(ids.join(","))}`, { cache: "no-store" });
      if (!response.ok) return;
      const body = await response.json();
      if (cancelled) return;
      setSignedIn(Boolean(body.signedIn));
      setFavoriteIds((current) => {
        const next = new Set(current);
        for (const id of body.favoriteIds ?? []) next.add(id);
        return next;
      });
    } catch {
      // Favorites are optional UI state; the public catalog should still render.
    }
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const params = new URLSearchParams(queryString);
      params.set("cursor", nextCursor);
      const response = await fetch(`/api/listings?${params.toString()}`);
      const body = await response.json().catch(() => ({})) as CatalogPayload;
      if (!response.ok) throw new Error(body.error || "Could not load more listings.");
      const more = body.listings ?? [];
      setListings((current) => [...current, ...more]);
      setNextCursor(body.nextCursor ?? null);
      setHasMore(Boolean(body.hasMore));
      await loadFavorites(more.map((listing) => listing.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load more listings.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div>
      <section className="mb-8">
        <div className="mb-3 inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          P2PCars — People to People car marketplace
        </div>
        <h1 className="text-3xl font-semibold">Private used cars for sale in Alberta</h1>
        <p className="mt-2 max-w-2xl text-prairie-600">
          Buy directly from private owners. No dealership inventory mixed into your search.
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
        {loading ? "Loading listings…" : listings.length ? `Showing ${listings.length} listings` : "No listings"}
      </p>

      {!loading && !error && listings.length === 0 ? (
        <p className="py-12 text-center text-prairie-600">No listings match these filters.</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <article key={listing.id} className="relative overflow-hidden rounded-2xl border border-prairie-200 bg-white transition-shadow hover:shadow-md">
              <div className="absolute right-3 top-3 z-10">
                <FavoriteButton listingId={listing.id} initialFavorite={favoriteIds.has(listing.id)} signedIn={signedIn} compact />
              </div>
              {listing.status === "sold" && (
                <span className="absolute left-3 top-3 z-10 rounded-full bg-slate-950/90 px-3 py-1 text-xs font-bold text-white">SOLD</span>
              )}
              <Link href={`/listings/${listing.id}`} className="group block">
                <div className="aspect-[4/3] overflow-hidden bg-prairie-100">
                  {listing.images?.[0] ? (
                    <img src={listing.images[0]} alt={`${listing.year} ${listing.make} ${listing.model}`} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-prairie-400">Photo unavailable</div>
                  )}
                </div>
                <div className="p-4">
                  <p className="font-semibold">{listing.year} {listing.make} {listing.model}</p>
                  <p className="text-lg font-semibold text-rig-700">{formatPriceCAD(listing.price)}</p>
                  <p className="text-sm text-prairie-600">{formatMileageKm(listing.mileage)}{listing.city ? ` · ${listing.city}` : ""}</p>
                </div>
              </Link>
            </article>
          ))}
        </div>
      )}

      {!loading && !error && hasMore && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-full border border-prairie-300 bg-white px-5 py-2.5 text-sm font-semibold hover:border-rig-700 disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
