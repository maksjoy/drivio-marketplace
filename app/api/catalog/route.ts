import { NextRequest } from "next/server";
import { createClient as createPublicClient } from "@supabase/supabase-js";
import { z } from "zod";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import { parseOptionalInt } from "@/lib/listings";

const PAGE_SIZE = 24;
const sortSchema = z.enum(["recent", "price_asc", "price_desc", "year_desc", "year_asc", "mileage_asc"]);
type CatalogSort = z.infer<typeof sortSchema>;
type CatalogCursor = { sort: CatalogSort; value: string | number; id: string };
type CatalogImageMeta = { firstPath: string | null; count: number };

const publicSupabase = createPublicClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const parsedSort = sortSchema.safeParse(params.get("sort") || "recent");
  const sort: CatalogSort = parsedSort.success ? parsedSort.data : "recent";
  const cursor = decodeCursor(params.get("cursor"), sort);

  const buildQuery = () => {
    let query = publicSupabase
      .from("listings")
      .select("id,make,model,year,price,mileage,body_type,transmission,fuel,drivetrain,city,engine,status,sold_at,created_at")
      .in("status", ["active", "sold"]);

    if (sort === "price_asc") query = query.order("price", { ascending: true }).order("id", { ascending: true });
    else if (sort === "price_desc") query = query.order("price", { ascending: false }).order("id", { ascending: false });
    else if (sort === "year_desc") query = query.order("year", { ascending: false }).order("id", { ascending: false });
    else if (sort === "year_asc") query = query.order("year", { ascending: true }).order("id", { ascending: true });
    else if (sort === "mileage_asc") query = query.order("mileage", { ascending: true }).order("id", { ascending: true });
    else query = query.order("created_at", { ascending: false }).order("id", { ascending: false });

    if (cursor) query = applyCursor(query, cursor);

    const city = params.get("city")?.trim();
    if (city) query = query.eq("city", city);
    const make = params.get("make")?.trim();
    if (make) query = query.eq("make", make);
    const model = params.get("model")?.trim();
    if (model) query = query.eq("model", model);
    const fuel = params.get("fuel")?.trim();
    if (fuel) query = query.eq("fuel", fuel);
    const bodyType = params.get("bodyType")?.trim();
    if (bodyType) query = query.eq("body_type", bodyType);
    const transmission = params.get("transmission")?.trim();
    if (transmission) query = query.eq("transmission", transmission);
    const drivetrain = params.get("drivetrain")?.trim();
    if (drivetrain) query = query.eq("drivetrain", drivetrain);

    const priceMin = parseOptionalInt(params.get("priceMin"));
    if (priceMin !== null && priceMin >= 0) query = query.gte("price", priceMin);
    const priceMax = parseOptionalInt(params.get("priceMax"));
    if (priceMax !== null && priceMax >= 0) query = query.lte("price", priceMax);
    const yearMin = parseOptionalInt(params.get("yearMin"));
    if (yearMin !== null && yearMin >= 1980) query = query.gte("year", yearMin);
    const yearMax = parseOptionalInt(params.get("yearMax"));
    if (yearMax !== null && yearMax >= 1980) query = query.lte("year", yearMax);
    const mileageMax = parseOptionalInt(params.get("mileageMax"));
    if (mileageMax !== null && mileageMax >= 0) query = query.lte("mileage", mileageMax);

    return query.limit(PAGE_SIZE + 1);
  };

  let result = await buildQuery();
  if (result.error && isTransient(result.error.message)) {
    await delay(150);
    result = await buildQuery();
  }

  if (result.error) {
    console.error("Unable to load public catalog", result.error);
    return Response.json({ error: "Listings are temporarily unavailable." }, { status: 503 });
  }

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

  // Catalog cards only need one thumbnail. Signing every gallery image multiplies Storage work
  // and response size without improving the marketplace grid.
  const firstPaths = Array.from(imageMetaByListing.values())
    .map((item) => item.firstPath)
    .filter((path): path is string => Boolean(path));
  const uniquePaths = Array.from(new Set(firstPaths));
  const signedByPath = new Map<string, string>();

  if (uniquePaths.length) {
    const { data: signed, error: signError } = await publicSupabase.storage
      .from("listing-photos")
      .createSignedUrls(uniquePaths, 3600);

    if (signError) {
      console.warn("Catalog thumbnails could not be signed; continuing without photos", signError);
    } else {
      (signed ?? []).forEach((item: any, index: number) => {
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
      status: row.status,
      soldAt: row.sold_at,
      images: thumbnailUrl ? [thumbnailUrl] : [],
      imageCount: imageMeta.count,
      createdAt: row.created_at,
    };
  });

  const nextCursor = hasMore && pageRows.length ? encodeCursor(sort, pageRows[pageRows.length - 1]) : null;

  return Response.json(
    { listings, pageSize: PAGE_SIZE, hasMore, nextCursor },
    {
      headers: {
        "Cache-Control": "public, max-age=0, must-revalidate",
        "Vercel-CDN-Cache-Control": "public, max-age=30, stale-while-revalidate=120",
      },
    },
  );
}

function isTransient(message?: string | null) {
  const value = (message || "").toLowerCase();
  return value.includes("timeout") || value.includes("temporarily") || value.includes("connection") || value.includes("gateway");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeCursor(raw: string | null, sort: CatalogSort): CatalogCursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (!parsed || parsed.sort !== sort || typeof parsed.id !== "string" || !/^[0-9a-f-]{36}$/i.test(parsed.id)) return null;
    if (sort === "recent" && typeof parsed.value !== "string") return null;
    if (sort !== "recent" && (typeof parsed.value !== "number" || !Number.isFinite(parsed.value))) return null;
    return parsed as CatalogCursor;
  } catch {
    return null;
  }
}

function applyCursor(query: any, cursor: CatalogCursor) {
  const direction = cursor.sort === "price_asc" || cursor.sort === "year_asc" || cursor.sort === "mileage_asc" ? "gt" : "lt";
  const column = cursor.sort.startsWith("price") ? "price"
    : cursor.sort.startsWith("year") ? "year"
      : cursor.sort === "mileage_asc" ? "mileage"
        : "created_at";
  return query.or(`${column}.${direction}.${cursor.value},and(${column}.eq.${cursor.value},id.${direction}.${cursor.id})`);
}

function encodeCursor(sort: CatalogSort, row: any) {
  const value = sort.startsWith("price") ? Number(row.price)
    : sort.startsWith("year") ? Number(row.year)
      : sort === "mileage_asc" ? Number(row.mileage)
        : String(row.created_at);
  return Buffer.from(JSON.stringify({ sort, value, id: row.id }), "utf8").toString("base64url");
}
