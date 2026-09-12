import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { MAX_ACTIVE_LISTINGS_PER_USER, parseOptionalInt, vehicleFeatures } from "@/lib/listings";

const PAGE_SIZE = 24;
const PHOTO_MAX_BYTES = 3 * 1024 * 1024;
const allowedFeatures = new Set<string>(vehicleFeatures);
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

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
  const supabase = await createClient();
  const params = request.nextUrl.searchParams;
  const requestedPage = parseOptionalInt(params.get("page"));
  const page = Math.max(1, requestedPage ?? 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("listings")
    .select("*, listing_images(storage_path, thumb_path, position)", { count: "exact" })
    .in("status", ["active", "sold"])
    .range(from, to);

  const sort = params.get("sort") || "recent";
  if (sort === "price_asc") query = query.order("price", { ascending: true }).order("id", { ascending: true });
  else if (sort === "price_desc") query = query.order("price", { ascending: false }).order("id", { ascending: false });
  else if (sort === "year_desc") query = query.order("year", { ascending: false }).order("id", { ascending: false });
  else if (sort === "year_asc") query = query.order("year", { ascending: true }).order("id", { ascending: true });
  else if (sort === "mileage_asc") query = query.order("mileage", { ascending: true }).order("id", { ascending: true });
  else query = query.order("created_at", { ascending: false }).order("id", { ascending: false });

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

  const { data, error, count } = await query;
  if (error) {
    console.error("Unable to load listings", error);
    return Response.json({ error: "Listings are temporarily unavailable." }, { status: 503 });
  }

  const listings = await Promise.all((data ?? []).map((row) => serializeRow(row, supabase)));
  const { data: { user } } = await supabase.auth.getUser();
  let favoriteIds: string[] = [];
  if (user && listings.length) {
    const { data: favorites } = await supabase.from("favorites").select("listing_id")
      .eq("user_id", user.id).in("listing_id", listings.map((listing) => listing.id));
    favoriteIds = (favorites ?? []).map((favorite) => favorite.listing_id);
  }

  return Response.json({ listings, page, pageSize: PAGE_SIZE, total: count ?? 0, signedIn: Boolean(user), favoriteIds });
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

  const images = formData.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);
  if (images.length < 1 || images.length > 8) return Response.json({ error: "Add between 1 and 8 photos." }, { status: 400 });
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  for (const image of images) {
    if (!allowedTypes.has(image.type) || image.size > PHOTO_MAX_BYTES) {
      return Response.json({ error: "Photos must be JPG, PNG or WebP and no larger than 3 MB each after resizing." }, { status: 400 });
    }
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

  const uploads: { storage_path: string; position: number }[] = [];
  try {
    for (let position = 0; position < images.length; position++) {
      const file = images[position];
      const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${user.id}/${created.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("listing-photos").upload(path, file, {
        contentType: file.type, cacheControl: "31536000", upsert: false,
      });
      if (uploadError) throw uploadError;
      uploads.push({ storage_path: path, position });
    }

    const { error: imageInsertError } = await supabase.from("listing_images").insert(
      uploads.map((upload) => ({ listing_id: created.id, ...upload })),
    );
    if (imageInsertError) throw imageInsertError;
  } catch (error) {
    console.error("Unable to save listing photos", error);
    if (uploads.length) await supabase.storage.from("listing-photos").remove(uploads.map((item) => item.storage_path));
    await supabase.from("listings").delete().eq("id", created.id);
    return Response.json({ error: "Photo upload failed. Please resize the photos and try again." }, { status: 500 });
  }

  return Response.json({ listingId: created.id, message: "Submitted for review. Your listing will appear after approval." }, { status: 201 });
}

async function serializeRow(row: any, supabase: Awaited<ReturnType<typeof createClient>>) {
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
