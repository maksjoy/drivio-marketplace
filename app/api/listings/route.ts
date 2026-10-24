import { NextRequest, NextResponse } from "next/server";
import { createClient as createPublicClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import { applyCatalogFilters, applyCatalogSort, parseCatalogSearch } from "@/lib/catalog-search";
import { applyCursor, decodeCursor, encodeCursor } from "@/lib/catalog-cursor";
import { CATALOG_QUERY_BYTE_LIMIT } from "@/lib/catalog-params";
import { clientIpFromHeaders } from "@/lib/client-ip";
import { listingColumns, listingCreateSchema } from "@/lib/listing-schema";
import { listingWriteError } from "@/lib/listing-write";
import { MAX_ACTIVE_LISTINGS_PER_USER, parseOptionalInt } from "@/lib/listings";
import { CATALOG_RATE_LIMIT, enforceSlidingRateLimit, LISTINGS_GET_RATE_PREFIX, rateLimitResponse } from "@/lib/sliding-rate-limit";

const PAGE_SIZE = 24;
const MAX_PHOTOS = 8;
const PRIVATE_RESPONSE = { "Cache-Control": "private, no-store" };

const publicSupabase = createPublicClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

export async function GET(request: NextRequest) {
  if (Buffer.byteLength(request.nextUrl.search) > CATALOG_QUERY_BYTE_LIMIT) {
    return Response.json({ error: "Search query is too long." }, { status: 400, headers: PRIVATE_RESPONSE });
  }

  const limit = await enforceSlidingRateLimit({
    prefix: LISTINGS_GET_RATE_PREFIX,
    identifier: clientIpFromHeaders(request.headers),
    tokens: CATALOG_RATE_LIMIT.tokens,
    window: CATALOG_RATE_LIMIT.window,
  });
  if (limit.limited) return rateLimitResponse(limit.retryAfterSeconds);

  const parsed = parseCatalogSearch(request.nextUrl.searchParams);
  if (!parsed.ok) return Response.json({ error: parsed.message }, { status: parsed.status, headers: PRIVATE_RESPONSE });
  if (request.nextUrl.searchParams.toString() !== parsed.canonical) {
    const url = request.nextUrl.clone();
    url.search = parsed.canonical;
    return NextResponse.redirect(url, 308);
  }

  const filters = parsed.data;
  const cursor = filters.cursor ? decodeCursor(filters.cursor, filters.sort) : null;
  let query = publicSupabase
    .from("listings")
    .select("id,make,model,year,price,mileage,body_type,transmission,fuel,drivetrain,city,color,engine,description,features,status,sold_at,created_at,listing_images(storage_path,thumb_path,position)")
    .in("status", ["active", "sold"]);
  query = applyCatalogFilters(query, filters);
  query = applyCatalogSort(query, filters.sort);
  if (cursor) query = applyCursor(query, cursor);

  const { data, error } = await query.limit(PAGE_SIZE + 1);
  if (error) {
    console.error("Unable to load listings", error);
    return Response.json({ error: "Listings are temporarily unavailable." }, { status: 503, headers: PRIVATE_RESPONSE });
  }

  const rows = data ?? [];
  const hasMore = rows.length > PAGE_SIZE;
  const pageRows = rows.slice(0, PAGE_SIZE);
  const listings = await Promise.all(pageRows.map((row) => serializeRow(row, publicSupabase)));
  const nextCursor = hasMore && pageRows.length ? encodeCursor(filters.sort, pageRows[pageRows.length - 1]) : null;
  const countResult = cursor
    ? { count: null as number | null, error: null }
    : await applyCatalogFilters(
      publicSupabase.from("listings").select("id", { count: "estimated", head: true }).in("status", ["active", "sold"]),
      filters,
    );
  if (countResult.error) console.error("Unable to estimate listing count", countResult.error);
  const estimatedCount = cursor || countResult.error || typeof countResult.count !== "number" ? null : countResult.count;

  return Response.json(
    { listings, pageSize: PAGE_SIZE, hasMore, nextCursor, estimatedCount },
    {
      headers: {
        "Cache-Control": "public, max-age=0, must-revalidate",
        "Vercel-CDN-Cache-Control": "public, max-age=30, stale-while-revalidate=120",
      },
    },
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to create a listing." }, { status: 401 });

  const { count: activeCount, error: countError } = await supabase.from("listings")
    .select("id", { count: "exact", head: true }).eq("user_id", user.id).in("status", ["pending", "active"]);
  if (countError) return Response.json({ error: "Could not verify your listing limit." }, { status: 503 });
  if ((activeCount ?? 0) >= MAX_ACTIVE_LISTINGS_PER_USER) {
    return Response.json({ error: `You've reached the limit of ${MAX_ACTIVE_LISTINGS_PER_USER} active or pending listings.` }, { status: 429 });
  }

  const formData = await request.formData();
  const parsed = listingCreateSchema.safeParse({
    make: formData.get("make"),
    model: formData.get("model"),
    year: formData.get("year"),
    price: formData.get("price"),
    mileage: formData.get("mileage"),
    fuel: formData.get("fuel"),
    bodyType: formData.get("bodyType") ?? "",
    transmission: formData.get("transmission") ?? "",
    drivetrain: formData.get("drivetrain") ?? "",
    city: formData.get("city") ?? "",
    color: formData.get("color") ?? "",
    engineL: formData.get("engineL") ?? "",
    powerHp: formData.get("powerHp") ?? "",
    description: formData.get("description") ?? "",
    features: formData.getAll("features"),
    sellerPhone: formData.get("sellerPhone") ?? "",
  });
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Check the listing details." }, { status: 400 });

  const photoCount = parseOptionalInt(String(formData.get("photoCount") ?? ""));
  if (photoCount === null || photoCount < 1 || photoCount > MAX_PHOTOS) {
    return Response.json({ error: `Add between 1 and ${MAX_PHOTOS} photos.` }, { status: 400 });
  }

  const data = parsed.data;
  if (data.sellerPhone) {
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: user.id,
      display_name: user.email?.split("@")[0] ?? "User",
      phone: data.sellerPhone,
    }, { onConflict: "id" });
    if (profileError) return Response.json({ error: "Could not save your private phone number." }, { status: 500 });
  }

  const { data: created, error: insertError } = await supabase.from("listings").insert({
    user_id: user.id,
    seller_name: "Private seller",
    ...listingColumns(data),
    status: "pending",
  }).select("id").single();

  if (insertError || !created) {
    console.error("Unable to create listing", insertError);
    const mapped = listingWriteError(insertError);
    return Response.json({ error: mapped.message }, { status: mapped.status });
  }

  const uploadPlans: Array<{
    position: number;
    storagePath: string;
    storageToken: string;
    thumbPath: string;
    thumbToken: string;
  }> = [];
  const imageRows: Array<{ listing_id: string; storage_path: string; thumb_path: string; position: number }> = [];

  try {
    for (let position = 0; position < photoCount; position++) {
      const key = crypto.randomUUID();
      const storagePath = `${user.id}/${created.id}/${key}.jpg`;
      const thumbPath = `${user.id}/${created.id}/${key}-thumb.jpg`;
      const [main, thumb] = await Promise.all([
        supabase.storage.from("listing-photos").createSignedUploadUrl(storagePath),
        supabase.storage.from("listing-photos").createSignedUploadUrl(thumbPath),
      ]);
      if (main.error || thumb.error || !main.data?.token || !thumb.data?.token) {
        throw main.error || thumb.error || new Error("Could not create photo upload URLs.");
      }
      uploadPlans.push({
        position,
        storagePath,
        storageToken: main.data.token,
        thumbPath,
        thumbToken: thumb.data.token,
      });
      imageRows.push({ listing_id: created.id, storage_path: storagePath, thumb_path: thumbPath, position });
    }

    const { error: imageInsertError } = await supabase.from("listing_images").insert(imageRows);
    if (imageInsertError) throw imageInsertError;
  } catch (error) {
    console.error("Unable to prepare direct photo uploads", error);
    await supabase.from("listings").delete().eq("id", created.id);
    return Response.json({ error: "We could not prepare your photo uploads. Please try again." }, { status: 500 });
  }

  return Response.json(
    {
      listingId: created.id,
      uploads: uploadPlans,
      message: "Listing created. Uploading optimized photos…",
    },
    { status: 201 },
  );
}

async function serializeRow(row: {
  id: string;
  make: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  body_type: string | null;
  transmission: string | null;
  fuel: string;
  drivetrain: string | null;
  city: string | null;
  color: string | null;
  engine: string | null;
  description: string | null;
  features: string[] | null;
  status: string;
  sold_at: string | null;
  created_at: string;
  listing_images?: Array<{ storage_path: string | null; thumb_path: string | null; position: number }> | null;
}, supabase: {
  storage: { from: (bucket: string) => { createSignedUrls: (paths: string[], expiresIn: number) => Promise<{ data: Array<{ signedUrl?: string } | null> | null }> } };
}) {
  const images = (row.listing_images ?? []).slice().sort((a, b) => a.position - b.position);
  const paths = images.map((image) => image.thumb_path || image.storage_path).filter((path): path is string => Boolean(path));
  const { data: signed } = paths.length
    ? await supabase.storage.from("listing-photos").createSignedUrls(paths, 3600)
    : { data: [] as { signedUrl?: string }[] };
  return {
    id: row.id, make: row.make, model: row.model, year: row.year, price: row.price, mileage: row.mileage,
    bodyType: row.body_type, transmission: row.transmission, fuel: row.fuel, drivetrain: row.drivetrain,
    city: row.city, color: row.color, engine: row.engine, description: row.description,
    features: row.features ?? [], status: row.status, soldAt: row.sold_at,
    images: (signed ?? []).map((item) => item?.signedUrl).filter((url): url is string => Boolean(url)),
    createdAt: row.created_at,
  };
}
