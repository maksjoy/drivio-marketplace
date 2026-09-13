import { NextRequest } from "next/server";
import { createClient as createPublicClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import { MAX_ACTIVE_LISTINGS_PER_USER, parseOptionalInt, vehicleFeatures } from "@/lib/listings";

const PAGE_SIZE = 24;
const MAX_PHOTOS = 8;
const allowedFeatures = new Set<string>(vehicleFeatures);
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const sortSchema = z.enum(["recent", "price_asc", "price_desc", "year_desc", "year_asc", "mileage_asc"]);
type CatalogSort = z.infer<typeof sortSchema>;

type CatalogCursor = {
  sort: CatalogSort;
  value: string | number;
  id: string;
};

const publicSupabase = createPublicClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const listingSchema = z
  .object({
    make: z.string().trim().min(1).max(80),
    model: z.string().trim().min(1).max(120),
    year: z.coerce.number().int().min(1980).max(new Date().getFullYear() + 1),
    price: z.coerce.number().int().min(500).max(2_000_000),
    mileage: z.coerce.number().int().min(0).max(2_000_000),
    fuel: z.string().trim().min(1).max(40),
    bodyType: optionalText(40),
    transmission: optionalText(40),
    drivetrain: optionalText(40),
    city: optionalText(80),
    color: optionalText(50),
    engine: optionalText(80),
    description: optionalText(3000),
    features: z.array(z.string().trim().max(60)).max(vehicleFeatures.length)
      .refine((items) => items.every((item) => allowedFeatures.has(item)), "Choose valid vehicle features."),
    sellerPhone: optionalText(30),
    sellerEmail: z.string().trim().email().max(254).optional().or(z.literal("")),
  })
  .refine((data) => Boolean(data.sellerPhone || data.sellerEmail), {
    message: "Add a phone number or email address.",
  });

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const parsedSort = sortSchema.safeParse(params.get("sort") || "recent");
  const sort: CatalogSort = parsedSort.success ? parsedSort.data : "recent";
  const cursor = decodeCursor(params.get("cursor"), sort);

  let query = publicSupabase
    .from("listings")
    .select("id,make,model,year,price,mileage,body_type,transmission,fuel,drivetrain,city,color,engine,description,features,status,sold_at,seller_name,seller_phone,seller_email,created_at,listing_images(storage_path,thumb_path,position)")
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
  if (make) query = query.ilike("make", make);
  const model = params.get("model")?.trim();
  if (model) query = query.ilike("model", model);
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

  const { data, error } = await query.limit(PAGE_SIZE + 1);
  if (error) {
    console.error("Unable to load listings", error);
    return Response.json({ error: "Listings are temporarily unavailable." }, { status: 503 });
  }

  const rows = data ?? [];
  const hasMore = rows.length > PAGE_SIZE;
  const pageRows = rows.slice(0, PAGE_SIZE);
  const listings = await Promise.all(pageRows.map((row) => serializeRow(row, publicSupabase)));
  const nextCursor = hasMore && pageRows.length ? encodeCursor(sort, pageRows[pageRows.length - 1]) : null;

  return Response.json(
    { listings, pageSize: PAGE_SIZE, hasMore, nextCursor },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } },
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
  const parsed = listingSchema.safeParse({
    make: formData.get("make"), model: formData.get("model"), year: formData.get("year"),
    price: formData.get("price"), mileage: formData.get("mileage"), fuel: formData.get("fuel"),
    bodyType: formData.get("bodyType") ?? "", transmission: formData.get("transmission") ?? "",
    drivetrain: formData.get("drivetrain") ?? "", city: formData.get("city") ?? "",
    color: formData.get("color") ?? "", engine: formData.get("engine") ?? "",
    description: formData.get("description") ?? "", features: formData.getAll("features"),
    sellerPhone: formData.get("sellerPhone") ?? "", sellerEmail: formData.get("sellerEmail") ?? "",
  });
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Check the listing details." }, { status: 400 });

  const photoCount = parseOptionalInt(String(formData.get("photoCount") ?? ""));
  if (photoCount === null || photoCount < 1 || photoCount > MAX_PHOTOS) {
    return Response.json({ error: `Add between 1 and ${MAX_PHOTOS} photos.` }, { status: 400 });
  }

  const data = parsed.data;
  if (data.sellerPhone) {
    await supabase.from("profiles").upsert({
      id: user.id,
      display_name: user.email?.split("@")[0] ?? "User",
      phone: data.sellerPhone,
    }, { onConflict: "id" });
  }

  const { data: created, error: insertError } = await supabase.from("listings").insert({
    user_id: user.id,
    seller_name: user.email?.split("@")[0] ?? "Private seller",
    seller_phone: data.sellerPhone || null,
    seller_email: data.sellerEmail || user.email || null,
    make: data.make, model: data.model, year: data.year, price: data.price, mileage: data.mileage,
    fuel: data.fuel, body_type: data.bodyType || null, transmission: data.transmission || null,
    drivetrain: data.drivetrain || null, city: data.city || null, color: data.color || null,
    engine: data.engine || null, description: data.description || null, features: data.features,
    status: "pending",
  }).select().single();

  if (insertError || !created) {
    console.error("Unable to create listing", insertError);
    return Response.json({ error: insertError?.message || "We could not submit your listing." }, { status: 500 });
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

async function serializeRow(row: any, supabase: any) {
  const images = (row.listing_images ?? []).slice().sort((a: any, b: any) => a.position - b.position);
  const paths = images.map((image: any) => image.thumb_path || image.storage_path).filter(Boolean);
  const { data: signed } = paths.length
    ? await supabase.storage.from("listing-photos").createSignedUrls(paths, 3600)
    : { data: [] as { signedUrl: string }[] };
  return {
    id: row.id, make: row.make, model: row.model, year: row.year, price: row.price, mileage: row.mileage,
    bodyType: row.body_type, transmission: row.transmission, fuel: row.fuel, drivetrain: row.drivetrain,
    city: row.city, color: row.color, engine: row.engine, description: row.description,
    features: row.features ?? [], status: row.status, soldAt: row.sold_at,
    images: (signed ?? []).map((item: any) => item.signedUrl).filter(Boolean),
    sellerName: row.seller_name, sellerPhone: row.seller_phone, sellerEmail: row.seller_email,
    createdAt: row.created_at,
  };
}
