"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { albertaCities, formatEngineDisplacement, formatMileageKm, formatPriceCAD } from "@/lib/listings";
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
  imageCount?: number;
};

type CatalogPayload = {
  listings?: Listing[];
  hasMore?: boolean;
  nextCursor?: string | null;
  error?: string;
};

// Alberta buyers lean toward trucks, SUVs and diesel, so those lead the quick searches.
// Each link only sets filters the catalog API already supports.
const quickSearches = [
  { label: "Pickups", href: "/?bodyType=Pickup" },
  { label: "SUVs", href: "/?bodyType=SUV" },
  { label: "Diesel", href: "/?fuel=Diesel" },
  { label: "Under $10,000", href: "/?priceMax=10000" },
] as const;

export function HomeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const normalizedParams = new URLSearchParams(searchParams.toString());
  normalizedParams.delete("page");
  normalizedParams.delete("cursor");
  const queryString = normalizedParams.toString();
  const currentSort = normalizedParams.get("sort") || "recent";

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
        const response = await fetch(`/api/catalog${queryString ? `?${queryString}` : ""}`);
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
      const response = await fetch(`/api/catalog?${params.toString()}`);
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

  function changeSort(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    params.delete("cursor");
    if (value === "recent") params.delete("sort");
    else params.set("sort", value);
    const query = params.toString();
    router.replace(query ? `/?${query}` : "/", { scroll: false });
  }

  return (
    <div>
      <section className="-mx-4 -mt-8 bg-primary-strong px-4 pb-14 pt-8 text-white md:mx-0 md:mt-0 md:rounded-2xl md:px-10 md:pb-16 md:pt-12">
        <h1 className="max-w-[15ch] text-[36px] font-extrabold leading-[1.02] tracking-tight [font-stretch:85%] md:text-[60px]">
          Used cars from Alberta owners
        </h1>
        <p className="mt-3 max-w-md text-base text-white/85 md:text-lg">
          No dealers. No fees. Message the seller directly.
        </p>
        <nav className="mt-5 flex flex-wrap gap-2" aria-label="Quick searches">
          {quickSearches.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="inline-flex min-h-11 items-center rounded-full border border-white/35 px-4 text-[15px] font-semibold text-white transition-colors hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </section>

      <div className="relative z-10 -mt-7 md:-mt-8 md:px-6">
        <Filters cities={albertaCities} />
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
          <p className="font-semibold">Could not load listings</p>
          <p className="mt-1 break-words">{error}</p>
        </div>
      )}

      <div id="marketplace-results" className="mb-4 mt-5 flex flex-wrap items-end justify-between gap-3">
        <p className="font-display text-[22px] font-bold leading-none text-ink [font-stretch:90%] md:text-[28px]">
          {loading ? "Loading cars…" : (
            <>
              {listings.length} {listings.length === 1 ? "car" : "cars"}{" "}
              <span className="font-medium text-muted">in Alberta</span>
            </>
          )}
        </p>
        <label className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink-soft">
          <span className="whitespace-nowrap">Sort by</span>
          <select
            aria-label="Sort listings"
            value={currentSort}
            onChange={(event) => changeSort(event.target.value)}
            className="h-11 max-w-[13rem] rounded-xl border-2 border-line bg-white px-3 text-base font-semibold text-ink outline-none focus:border-primary"
          >
            <option value="recent">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="year_desc">Year: new to old</option>
            <option value="year_asc">Year: old to new</option>
            <option value="mileage_asc">Mileage: low to high</option>
          </select>
        </label>
      </div>

      {!loading && !error && listings.length === 0 ? (
        <div className="py-14 text-center">
          <p className="font-display text-xl font-bold text-ink">No cars match these filters</p>
          <p className="mt-1 text-muted">Remove a filter or widen the price range.</p>
          <Link href="/" className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-line-strong px-5 font-semibold text-primary-strong transition-colors hover:bg-surface-sunken">
            Clear filters
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {listings.map((listing) => (
            <VehicleCard key={listing.id} listing={listing} signedIn={signedIn} favorite={favoriteIds.has(listing.id)} />
          ))}
        </div>
      )}

      {!loading && !error && hasMore && (
        <div className="mt-8 flex justify-center">
          <button type="button" onClick={loadMore} disabled={loadingMore} className="min-h-12 rounded-xl border-2 border-primary-strong bg-white px-7 py-3 text-base font-bold text-primary-strong transition hover:bg-primary-soft disabled:opacity-50">
            {loadingMore ? "Loading…" : "Show more cars"}
          </button>
        </div>
      )}
    </div>
  );
}

function VehicleCard({ listing, signedIn, favorite }: { listing: Listing; signedIn: boolean; favorite: boolean }) {
  const imageCount = listing.imageCount ?? listing.images.length;
  const sold = listing.status === "sold";
  const overlayBadge = sold ? "SOLD" : justListed(listing.createdAt) ? "Just listed" : null;
  const photoBadge = imageCount > 1 ? `1 / ${imageCount}` : null;
  const specs: { label: string; value: string }[] = [
    { label: "Mileage", value: formatMileageKm(listing.mileage) },
    { label: "Drivetrain", value: listing.drivetrain || "—" },
    { label: "Transmission", value: listing.transmission || "—" },
    { label: "Fuel", value: listing.fuel || "—" },
    { label: "Engine", value: formatEngineDisplacement(listing.engine) || "—" },
    { label: "Location", value: listing.city ? `${listing.city}, AB` : "Alberta" },
  ];

  return (
    <article className="relative overflow-hidden rounded-[14px] border border-line bg-surface transition-colors hover:border-primary/50">
      <div className="absolute right-3 top-3 z-10">
        <FavoriteButton listingId={listing.id} initialFavorite={favorite} signedIn={signedIn} compact />
      </div>
      <Link href={`/listings/${listing.id}`} className="group block focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary">
        <div className="relative aspect-[4/3] overflow-hidden bg-primary-soft">
          {listing.images?.[0] ? (
            <img src={listing.images[0]} alt={`${listing.year} ${listing.make} ${listing.model}`} width={1200} height={900} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted">Photo unavailable</div>
          )}
          {overlayBadge && (
            <span className={`absolute left-3 top-3 z-10 rounded-md px-2 py-1 text-xs font-semibold ${sold ? "bg-ink text-white" : "bg-white text-primary-strong"}`}>
              {overlayBadge}
            </span>
          )}
          {photoBadge && (
            <span className="absolute bottom-3 right-3 rounded-md bg-ink/70 px-2 py-1 text-xs font-medium text-white">
              {photoBadge}
            </span>
          )}
          <p className={`absolute bottom-0 left-0 rounded-tr-xl bg-white px-3.5 pb-2 pt-2.5 font-display text-[26px] font-extrabold leading-none [font-stretch:90%] ${sold ? "text-muted line-through decoration-2" : "text-primary-strong"}`}>
            {formatPriceCAD(listing.price)}
          </p>
        </div>
        <div className="px-4 pb-2 pt-3.5">
          <h3 className="truncate font-display text-[19px] font-bold leading-snug text-ink [font-stretch:92%]">{listing.year} {listing.make} {listing.model}</h3>
          <dl className="mt-2 grid grid-cols-2 gap-x-4" aria-label="Vehicle specifications">
            {specs.map((spec) => (
              <div key={spec.label} className="min-w-0 border-b border-line py-2 [&:nth-last-child(-n+2)]:border-b-0">
                <dt className="text-xs text-muted">{spec.label}</dt>
                <dd className="truncate text-[15px] font-semibold text-ink">{spec.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Link>
    </article>
  );
}

function justListed(value?: string | null) {
  if (!value) return false;
  const published = new Date(value);
  if (Number.isNaN(published.getTime())) return false;
  const days = Math.floor((Date.now() - published.getTime()) / 86_400_000);
  return days >= 0 && days < 2;
}
