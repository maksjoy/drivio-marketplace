"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { featureBadgeLabels, formatEngineDisplacement, formatMileageKm, formatPriceCAD } from "@/lib/listings";
import { CatalogFilterProvider, useCatalogFilters } from "@/components/catalog-filter-state";
import { Filters } from "@/components/filters";
import { FavoriteButton } from "@/components/favorite-button";
import { Chip } from "@/components/ui/chip";

type Listing = {
  id: string;
  make: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  city: string | null;
  engine?: string | null;
  fuel: string;
  transmission?: string | null;
  bodyType?: string | null;
  drivetrain?: string | null;
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
  estimatedCount?: number | null;
  error?: string;
};

export function HomeClient() {
  return (
    <CatalogFilterProvider>
      <HomeCatalog />
    </CatalogFilterProvider>
  );
}

function HomeCatalog() {
  const filters = useCatalogFilters();
  const queryString = filters.queryString;
  const currentSort = filters.sort;

  const [listings, setListings] = useState<Listing[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estimatedCount, setEstimatedCount] = useState<number | null>(null);

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
        setEstimatedCount(typeof body.estimatedCount === "number" ? body.estimatedCount : null);
        await loadFavorites(firstPage.map((listing) => listing.id), cancelled);
      } catch (err) {
        if (!cancelled) {
          setListings([]);
          setHasMore(false);
          setNextCursor(null);
          setEstimatedCount(null);
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
      params.delete("cursor");
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
    filters.setSort(value);
  }

  return (
    <div>
      <section className="-mx-4 -mt-8 bg-primary-soft px-4 pb-4 pt-4 md:pb-6 md:pt-7">
        <h1 className="max-w-xl text-[26px] font-semibold leading-tight tracking-tight text-ink md:text-[40px]">
          Find your next car{" "}
          <br className="md:hidden" />
          in Alberta
        </h1>
        <p className="mt-1.5 max-w-2xl text-[15px] text-muted md:mt-2 md:text-lg md:text-ink-soft">
          From private sellers. No dealers, no fees.
        </p>
      </section>

      <div className="mt-4">
        <Filters resultCount={estimatedCount} />
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
          <p className="font-semibold">Could not load listings</p>
          <p className="mt-1 break-words">{error}</p>
        </div>
      )}

      <div id="marketplace-results" className="mb-4 mt-5 flex flex-wrap items-end justify-between gap-3">
        <p className="text-base font-semibold text-ink md:text-xl">
          {loading ? "Loading cars…" : (() => {
            const total = estimatedCount ?? listings.length;
            return (
              <>
                {new Intl.NumberFormat("en-CA").format(total)} {total === 1 ? "car" : "cars"}{" "}
                <span className="font-normal text-muted">in Alberta</span>
              </>
            );
          })()}
        </p>
        <label className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink-soft">
          <span className="whitespace-nowrap">Sort by</span>
          <select
            aria-label="Sort listings"
            value={currentSort}
            onChange={(event) => changeSort(event.target.value)}
            className="h-11 max-w-[13rem] rounded-xl border-2 border-line bg-white px-3 text-base font-semibold text-ink outline-none focus:border-primary"
          >
            <option value="recent">Newest listed</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="year_desc">Year: new to old</option>
            <option value="year_asc">Year: old to new</option>
            <option value="mileage_asc">Mileage: low to high</option>
            <option value="mileage_desc">Mileage: high to low</option>
          </select>
        </label>
      </div>

      {!loading && !error && listings.length === 0 ? (
        <p className="py-12 text-center text-muted">No listings match these filters.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {listings.map((listing) => (
            <VehicleCard key={listing.id} listing={listing} signedIn={signedIn} favorite={favoriteIds.has(listing.id)} />
          ))}
        </div>
      )}

      {!loading && !error && hasMore && (
        <div className="mt-8 flex justify-center">
          <button type="button" onClick={loadMore} disabled={loadingMore} className="min-h-12 rounded-full border-2 border-primary-strong bg-white px-7 py-3 text-base font-bold text-primary-strong transition hover:bg-primary-soft disabled:opacity-50">
            {loadingMore ? "Loading…" : "Show more cars"}
          </button>
        </div>
      )}
    </div>
  );
}

function VehicleCard({ listing, signedIn, favorite }: { listing: Listing; signedIn: boolean; favorite: boolean }) {
  const badges = featureBadgeLabels(listing.features, 2);
  const imageCount = listing.imageCount ?? listing.images.length;
  const engineDisplay = formatEngineDisplacement(listing.engine) || "—";
  const overlayBadge = listing.status === "sold" ? "SOLD" : justListed(listing.createdAt) ? "Just listed" : null;
  const photoBadge = imageCount > 1 ? `1 / ${imageCount}` : null;

  return (
    <article className="relative overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition hover:shadow-lift">
      <div className="absolute right-3 top-3 z-10">
        <FavoriteButton listingId={listing.id} initialFavorite={favorite} signedIn={signedIn} compact />
      </div>
      <Link href={`/listings/${listing.id}`} className="group block">
        <div className="relative aspect-[4/3] overflow-hidden bg-primary-soft">
          {listing.images?.[0] ? (
            <img src={listing.images[0]} alt={`${listing.year} ${listing.make} ${listing.model}`} width={1200} height={900} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted">Photo unavailable</div>
          )}
          {overlayBadge && (
            <span className={`absolute left-3 top-3 z-10 rounded-full px-2.5 py-1 text-xs font-semibold ${overlayBadge === "SOLD" ? "bg-ink/90 text-white" : "bg-white/95 text-primary shadow-sm"}`}>
              {overlayBadge}
            </span>
          )}
          {photoBadge && (
            <span className={`absolute bottom-3 left-3 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-medium text-white ${overlayBadge ? "hidden md:inline" : ""}`}>
              {photoBadge}
            </span>
          )}
        </div>
        <div className="p-4">
          <h3 className="truncate text-[17px] font-semibold leading-snug text-ink">{listing.year} {listing.make} {listing.model}</h3>
          <p className="mt-1 text-[26px] font-bold leading-none tracking-tight text-ink">{formatPriceCAD(listing.price)}</p>
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 border-t border-line pt-3.5" aria-label="Vehicle specifications">
            <CardSpec kind="mileage" label="Mileage" value={formatMileageKm(listing.mileage)} />
            <CardSpec kind="transmission" label="Transmission" value={listing.transmission || "—"} />
            <CardSpec kind="fuel" label="Fuel type" value={listing.fuel || "—"} />
            <CardSpec kind="drivetrain" label="Drivetrain" value={listing.drivetrain || "—"} />
            <CardSpec kind="engine" label="Engine size" value={engineDisplay} />
          </div>
          {badges.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Chip tone="primary">{badges[0]}</Chip>
              {badges[1] && <span className="hidden sm:inline"><Chip tone="primary">{badges[1]}</Chip></span>}
            </div>
          )}
          <p className="mt-2 flex items-center gap-1.5 text-[13px] text-muted">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>
            {listing.city ? `${listing.city}, AB` : "Alberta"}
          </p>
        </div>
      </Link>
    </article>
  );
}

type CardSpecKind = "mileage" | "transmission" | "fuel" | "drivetrain" | "engine";

function CardSpec({ kind, label, value }: { kind: CardSpecKind; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5" title={`${label}: ${value}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-strong" aria-hidden="true">
        <SpecIcon kind={kind} />
      </span>
      <span className="min-w-0 break-words text-[13px] font-semibold leading-snug text-ink">{value}</span>
      <span className="sr-only">{label}</span>
    </div>
  );
}

function SpecIcon({ kind }: { kind: CardSpecKind }) {
  const common = "h-[18px] w-[18px]";
  if (kind === "fuel") return (
    <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 21V4.5A1.5 1.5 0 0 1 6.5 3h7A1.5 1.5 0 0 1 15 4.5V21M4 21h12M7.5 6h5v5h-5zM15 8h2l2 2.5V17a2 2 0 0 0 4 0v-5l-2-2" />
    </svg>
  );
  if (kind === "transmission") return (
    <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3v18M18 3v18M6 7h12M6 17h12M12 7v10M9.5 3h5M9.5 21h5" />
      <circle cx="6" cy="7" r="2" fill="currentColor" stroke="none" /><circle cx="18" cy="7" r="2" fill="currentColor" stroke="none" /><circle cx="12" cy="17" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
  if (kind === "drivetrain") return (
    <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 11 1.8-4.2A2 2 0 0 1 8.7 5.5h6.6a2 2 0 0 1 1.9 1.3L19 11l1.5 1.5V19h-17v-6.5L5 11Z" />
      <path d="M4 14h16M7 17h.01M17 17h.01M8 5.5 7 3h10l-1 2.5" />
    </svg>
  );
  if (kind === "engine") return (
    <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10h3l2-3h6l2 3h3a2 2 0 0 1 2 2v5h-3v2h-3v-2H9v2H6v-2H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2Z" />
      <path d="M11 7V4h4v3M18 12h2" />
    </svg>
  );
  return (
    <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="5.5" /><path d="m12 12 3.5-3M12 5v2M19 12h-2M12 19v-2M5 12h2" />
    </svg>
  );
}

function justListed(value?: string | null) {
  if (!value) return false;
  const published = new Date(value);
  if (Number.isNaN(published.getTime())) return false;
  const days = Math.floor((Date.now() - published.getTime()) / 86_400_000);
  return days >= 0 && days < 2;
}
