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
  fuel: string;
  transmission?: string | null;
  bodyType?: string | null;
  drivetrain?: string | null;
  engine?: string | null;
  features?: string[];
  createdAt?: string | null;
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
      <section className="mb-7">
        <div className="mb-3 inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          P2PCars — People to People car marketplace
        </div>
        <h1 className="text-3xl font-semibold">Find your next car in Alberta</h1>
        <p className="mt-2 max-w-2xl text-prairie-600">
          Private sellers only. Compare the important details before you even open a listing.
        </p>
      </section>

      <Filters cities={albertaCities} />

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">Could not load listings</p>
          <p className="mt-1 break-words">{error}</p>
        </div>
      )}

      <div id="marketplace-results" className="mb-4 mt-7 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-body text-xl font-bold text-rig-900">Cars for sale</h2>
          <p className="mt-0.5 text-sm text-prairie-600">
            {loading ? "Loading listings…" : listings.length ? `${listings.length} listings shown` : "No listings"}
          </p>
        </div>
      </div>

      {!loading && !error && listings.length === 0 ? (
        <p className="py-12 text-center text-prairie-600">No listings match these filters.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <VehicleCard
              key={listing.id}
              listing={listing}
              signedIn={signedIn}
              favorite={favoriteIds.has(listing.id)}
            />
          ))}
        </div>
      )}

      {!loading && !error && hasMore && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="min-h-12 rounded-full border-2 border-rig-900 bg-white px-7 py-3 text-base font-bold text-rig-900 transition hover:bg-prairie-100 disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Show more cars"}
          </button>
        </div>
      )}
    </div>
  );
}

function VehicleCard({ listing, signedIn, favorite }: { listing: Listing; signedIn: boolean; favorite: boolean }) {
  const fuelText = [listing.fuel, listing.engine].filter(Boolean).join(" · ");
  const tags = [listing.bodyType, listing.drivetrain].filter(Boolean).slice(0, 2) as string[];

  return (
    <article className="relative overflow-hidden rounded-[22px] border border-prairie-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="absolute right-3 top-3 z-10 rounded-full bg-white/95 shadow-sm backdrop-blur">
        <FavoriteButton listingId={listing.id} initialFavorite={favorite} signedIn={signedIn} compact />
      </div>
      {listing.status === "sold" && (
        <span className="absolute left-3 top-3 z-10 rounded-full bg-slate-950/90 px-3 py-1.5 text-xs font-bold text-white">SOLD</span>
      )}

      <Link href={`/listings/${listing.id}`} className="group block">
        <div className="relative aspect-[4/3] overflow-hidden bg-prairie-100">
          {listing.images?.[0] ? (
            <img
              src={listing.images[0]}
              alt={`${listing.year} ${listing.make} ${listing.model}`}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-prairie-400">Photo unavailable</div>
          )}
          {listing.images.length > 1 && (
            <span className="absolute bottom-3 right-3 rounded-full bg-black/65 px-2.5 py-1 text-xs font-semibold text-white">
              1 / {listing.images.length}
            </span>
          )}
        </div>

        <div className="p-4 font-body">
          <h3 className="text-lg font-extrabold leading-tight text-slate-950">
            {listing.year} {listing.make} {listing.model}
          </h3>
          <p className="mt-1 text-[26px] font-extrabold leading-none text-emerald-600">
            {formatPriceCAD(listing.price)}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm text-slate-700">
            <Spec icon="mileage" text={formatMileageKm(listing.mileage)} />
            <Spec icon="transmission" text={listing.transmission || "Not specified"} />
            <Spec icon="fuel" text={fuelText || "Not specified"} />
            <Spec icon="location" text={listing.city ? `${listing.city}, AB` : "Alberta"} />
          </div>

          {tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span key={tag} className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  {tag}
                </span>
              ))}
            </div>
          )}

          <p className="mt-4 border-t border-prairie-100 pt-3 text-xs font-medium text-prairie-500">
            {formatPublishedDate(listing.createdAt)}
          </p>
        </div>
      </Link>
    </article>
  );
}

function Spec({ icon, text }: { icon: "mileage" | "fuel" | "transmission" | "location"; text: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-prairie-100 text-rig-900" aria-hidden="true">
        {icon === "mileage" && (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M5 16a7 7 0 1 1 14 0" /><path d="m12 13 4-4" /><path d="M4 16h16" />
          </svg>
        )}
        {icon === "fuel" && (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M6 21V4h8v17" /><path d="M5 21h10" /><path d="M8 7h4" /><path d="M14 9h2l2 2v6a2 2 0 0 0 4 0v-6l-2-2" />
          </svg>
        )}
        {icon === "transmission" && (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="7" cy="6" r="2" /><circle cx="17" cy="6" r="2" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /><path d="M7 8v8M17 8v8M7 12h10" />
          </svg>
        )}
        {icon === "location" && (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" />
          </svg>
        )}
      </span>
      <span className="min-w-0 truncate font-medium">{text}</span>
    </div>
  );
}

function formatPublishedDate(value?: string | null) {
  if (!value) return "Recently published";
  const published = new Date(value);
  if (Number.isNaN(published.getTime())) return "Recently published";
  const days = Math.max(0, Math.floor((Date.now() - published.getTime()) / 86_400_000));
  if (days === 0) return "Published today";
  if (days === 1) return "Published yesterday";
  if (days < 7) return `Published ${days} days ago`;
  return `Published ${new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric" }).format(published)}`;
}
