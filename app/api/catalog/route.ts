import { NextRequest, NextResponse } from "next/server";
import { createClient as createPublicClient } from "@supabase/supabase-js";
import { applyCatalogFilters, applyCatalogSort, parseCatalogSearch } from "@/lib/catalog-search";
import { applyCursor, decodeCursor, encodeCursor } from "@/lib/catalog-cursor";
import { CATALOG_QUERY_BYTE_LIMIT } from "@/lib/catalog-params";
import { clientIpFromHeaders } from "@/lib/client-ip";
import { CATALOG_RATE_LIMIT, CATALOG_RATE_PREFIX, enforceSlidingRateLimit, rateLimitResponse } from "@/lib/sliding-rate-limit";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import { logServerError } from "@/lib/server-log";

const PAGE_SIZE = 24;
type CatalogImageMeta = { firstPath: string | null; count: number };

const publicSupabase = createPublicClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const PRIVATE_RESPONSE = { "Cache-Control": "private, no-store" };
// Fresh for 30s at the edge; after that the edge keeps answering instantly with the stale copy
// while it refetches in the background. 120s of SWR meant a quiet site fell out of the cache
// entirely and the next visitor waited for a cold function (1.5-4.5s measured on prod). The SWR
// window stays well inside the 3600s lifetime of the signed thumbnail URLs in the body, so a
// stale copy still has more than 25 minutes of valid image URLs.
const SIGNED_THUMB_TTL_SECONDS = 3600;
const PUBLIC_CACHE = { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=1800" };

export async function GET(request: NextRequest) {
  if (Buffer.byteLength(request.nextUrl.search) > CATALOG_QUERY_BYTE_LIMIT) {
    return Response.json({ error: "Search query is too long." }, { status: 400, headers: PRIVATE_RESPONSE });
  }

  const limit = await enforceSlidingRateLimit({
    prefix: CATALOG_RATE_PREFIX,
    identifier: clientIpFromHeaders(request.headers),
    tokens: CATALOG_RATE_LIMIT.tokens,
    window: CATALOG_RATE_LIMIT.window,
  });
  if (limit.limited) return rateLimitResponse(limit.retryAfterSeconds);

  const parsed = parseCatalogSearch(request.nextUrl.searchParams);
  if (!parsed.ok) {
    return Response.json({ error: parsed.message }, { status: parsed.status, headers: PRIVATE_RESPONSE });
  }
  if (request.nextUrl.searchParams.toString() !== parsed.canonical) {
    const url = request.nextUrl.clone();
    url.search = parsed.canonical;
    const redirect = NextResponse.redirect(url, 308);
    redirect.headers.set("Cache-Control", PUBLIC_CACHE["Cache-Control"]);
    return redirect;
  }

  const filters = parsed.data;
  const cursor = filters.cursor ? decodeCursor(filters.cursor, filters.sort) : null;

  const buildQuery = () => {
    let query = publicSupabase
      .from("listings")
      .select("id,make,model,year,price,mileage,body_type,transmission,fuel,drivetrain,city,engine,features,status,sold_at,created_at")
      .in("status", ["active", "sold"]);
    query = applyCatalogFilters(query, filters);
    query = applyCatalogSort(query, filters.sort);
    if (cursor) query = applyCursor(query, cursor);
    return query.limit(PAGE_SIZE + 1);
  };

  const buildCountQuery = () => {
    let query = publicSupabase
      .from("listings")
      .select("id", { count: "estimated", head: true })
      .in("status", ["active", "sold"]);
    query = applyCatalogFilters(query, filters);
    return query;
  };
  // The count does not depend on the page, so it runs alongside it (one round trip fewer).
  const countPromise = cursor
    ? Promise.resolve({ count: null as number | null, error: null })
    : Promise.resolve(buildCountQuery()).then((value) => value, (error: unknown) => ({ count: null as number | null, error }));

  let result = await buildQuery();
  if (result.error && isTransient(result.error.message)) {
    await delay(150);
    result = await buildQuery();
  }
  if (result.error) {
    logServerError("Unable to load public catalog", result.error);
    return Response.json({ error: "Listings are temporarily unavailable." }, { status: 503, headers: PRIVATE_RESPONSE });
  }

  const countResult = await countPromise;
  if (countResult.error) logServerError("Unable to estimate catalog size", countResult.error);

  const rows = result.data ?? [];
  const hasMore = rows.length > PAGE_SIZE;
  const pageRows = rows.slice(0, PAGE_SIZE);
  const listingIds = pageRows.map((row) => row.id);
  const imageMetaByListing = new Map<string, CatalogImageMeta>();

  if (listingIds.length) {
    let imageResult = await publicSupabase
      .from("listing_images")
      .select("listing_id,storage_path,thumb_path,position")
      .in("listing_id", listingIds)
      .order("position", { ascending: true });

    if (imageResult.error && isTransient(imageResult.error.message)) {
      await delay(120);
      imageResult = await publicSupabase
        .from("listing_images")
        .select("listing_id,storage_path,thumb_path,position")
        .in("listing_id", listingIds)
        .order("position", { ascending: true });
    }

    if (imageResult.error) {
      console.warn("Catalog photo metadata unavailable; continuing without photos", imageResult.error);
    } else {
      for (const image of imageResult.data ?? []) {
        const path = image.thumb_path || image.storage_path || null;
        const current = imageMetaByListing.get(image.listing_id) ?? { firstPath: null, count: 0 };
        current.count += 1;
        if (!current.firstPath && path) current.firstPath = path;
        imageMetaByListing.set(image.listing_id, current);
      }
    }
  }

  const firstPaths = Array.from(imageMetaByListing.values())
    .map((item) => item.firstPath)
    .filter((path): path is string => Boolean(path));
  const uniquePaths = Array.from(new Set(firstPaths));
  const signedByPath = new Map<string, string>();

  if (uniquePaths.length) {
    const { data: signed, error: signError } = await publicSupabase.storage
      .from("listing-photos")
      .createSignedUrls(uniquePaths, SIGNED_THUMB_TTL_SECONDS);

    if (signError) {
      console.warn("Catalog thumbnails could not be signed; continuing without photos", signError);
    } else {
      (signed ?? []).forEach((item: { signedUrl?: string | null } | null, index: number) => {
        if (item?.signedUrl) signedByPath.set(uniquePaths[index], item.signedUrl);
      });
    }
  }

  const listings = pageRows.map((row) => {
    const imageMeta = imageMetaByListing.get(row.id) ?? { firstPath: null, count: 0 };
    const thumbnailUrl = imageMeta.firstPath ? signedByPath.get(imageMeta.firstPath) : undefined;
    return {
      id: row.id,
      make: row.make,
      model: row.model,
      year: row.year,
      price: row.price,
      mileage: row.mileage,
      bodyType: row.body_type,
      transmission: row.transmission,
      fuel: row.fuel,
      drivetrain: row.drivetrain,
      city: row.city,
      engine: row.engine,
      features: row.features ?? [],
      status: row.status,
      soldAt: row.sold_at,
      images: thumbnailUrl ? [thumbnailUrl] : [],
      imageCount: imageMeta.count,
      createdAt: row.created_at,
    };
  });

  const nextCursor = hasMore && pageRows.length ? encodeCursor(filters.sort, pageRows[pageRows.length - 1]) : null;
  const estimatedCount = cursor || countResult.error || typeof countResult.count !== "number" ? null : countResult.count;

  return Response.json(
    { listings, pageSize: PAGE_SIZE, hasMore, nextCursor, estimatedCount },
    { headers: PUBLIC_CACHE },
  );
}

function isTransient(message?: string | null) {
  const value = (message || "").toLowerCase();
  return value.includes("timeout") || value.includes("temporarily") || value.includes("connection") || value.includes("gateway");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
