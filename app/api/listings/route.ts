import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  MAX_ACTIVE_LISTINGS_PER_USER,
  parseOptionalInt,
  vehicleFeatures,
} from "@/lib/listings";

const PAGE_SIZE = 24;
const allowedFeatures = new Set<string>(vehicleFeatures);

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

const listingSchema = z
  .object({
    make: z.string().trim().min(1).max(50),
    model: z.string().trim().min(1).max(80),
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
    features: z
      .array(z.string().trim().max(60))
      .max(vehicleFeatures.length)
      .refine((f) => f.every((feature) => allowedFeatures.has(feature)), "Choose valid vehicle features."),
    sellerPhone: optionalText(30),
    sellerEmail: z.string().trim().email().max(254).optional().or(z.literal("")),
    sellerTelegram: optionalText(80),
  })
  .refine((data) => Boolean(data.sellerPhone || data.sellerEmail || data.sellerTelegram), {
    message: "Add at least one contact method: phone, email or Telegram.",
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
    .select("*, listing_images(storage_path, position)", { count: "exact" })
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .range(from, to);

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

  const listings = (data ?? []).map((row) => serializeRow(row, supabase));
  return Response.json({ listings, page, pageSize: PAGE_SIZE, total: count ?? 0 });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Sign in to create a listing." }, { status: 401 });
  }

  const { count: activeCount, error: countError } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("status", ["pending", "active"]);

  if (countError) {
    console.error("Unable to check listing limit", countError);
    return Response.json({ error: "Could not verify your listing limit. Please try again." }, { status: 503 });
  }

  if ((activeCount ?? 0) >= MAX_ACTIVE_LISTINGS_PER_USER) {
    return Response.json(
      {
        error: `You've reached the limit of ${MAX_ACTIVE_LISTINGS_PER_USER} active or pending listings. Mark an old one as sold or remove it first.`,
      },
      { status: 429 },
    );
  }

  const formData = await request.formData();
  const parsed = listingSchema.safeParse({
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
    engine: formData.get("engine") ?? "",
    description: formData.get("description") ?? "",
    features: formData.getAll("features"),
    sellerPhone: formData.get("sellerPhone") ?? "",
    sellerEmail: formData.get("sellerEmail") ?? "",
    sellerTelegram: formData.get("sellerTelegram") ?? "",
  });

  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Check the listing details." },
      { status: 400 },
    );
  }

  const images = formData
    .getAll("images")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (images.length < 1 || images.length > 8) {
    return Response.json({ error: "Add between 1 and 8 photos." }, { status: 400 });
  }

  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  for (const image of images) {
    if (!allowedTypes.has(image.type) || image.size > 8 * 1024 * 1024) {
      return Response.json(
        { error: "Photos must be JPG, PNG or WebP and no larger than 8 MB each." },
        { status: 400 },
      );
    }
  }

  const data = parsed.data;

  if (data.sellerPhone) {
    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        display_name: user.user_metadata?.display_name ?? user.email?.split("@")[0] ?? "User",
        phone: data.sellerPhone,
      },
      { onConflict: "id" },
    );
    if (profileError) console.error("Unable to sync profile phone", profileError);
  }

  const { data: created, error: insertError } = await supabase
    .from("listings")
    .insert({
      user_id: user.id,
      seller_name: user.user_metadata?.display_name ?? user.email ?? "Private seller",
      seller_phone: data.sellerPhone || null,
      seller_email: data.sellerEmail || null,
      seller_telegram: data.sellerTelegram || null,
      make: data.make,
      model: data.model,
      year: data.year,
      price: data.price,
      mileage: data.mileage,
      fuel: data.fuel,
      body_type: data.bodyType || null,
      transmission: data.transmission || null,
      drivetrain: data.drivetrain || null,
      city: data.city || null,
      color: data.color || null,
      engine: data.engine || null,
      description: data.description || null,
      features: data.features,
      status: "active",
    })
    .select()
    .single();

  if (insertError || !created) {
    console.error("Unable to create listing", insertError);
    const isLimitError = insertError?.message?.includes("listing limit");
    return Response.json(
      {
        error: isLimitError
          ? `You've reached the limit of ${MAX_ACTIVE_LISTINGS_PER_USER} active or pending listings.`
          : "We could not submit your listing. Please try again.",
      },
      { status: isLimitError ? 429 : 500 },
    );
  }

  const uploadResults = await Promise.allSettled(
    images.map(async (file, position) => {
      const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${user.id}/${created.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("listing-photos")
        .upload(path, file, { contentType: file.type, cacheControl: "31536000" });
      if (uploadError) throw uploadError;
      return { storage_path: path, position };
    }),
  );

  const uploads = uploadResults
    .filter((result): result is PromiseFulfilledResult<{ storage_path: string; position: number }> => result.status === "fulfilled")
    .map((result) => result.value);
  const uploadFailed = uploadResults.some((result) => result.status === "rejected");

  if (uploadFailed) {
    console.error(
      "Image upload failed",
      uploadResults.filter((result) => result.status === "rejected"),
    );
    if (uploads.length > 0) {
      await supabase.storage.from("listing-photos").remove(uploads.map((item) => item.storage_path));
    }
    await supabase.from("listings").delete().eq("id", created.id);
    return Response.json({ error: "Photo upload failed. Please try again." }, { status: 500 });
  }

  const { error: imageInsertError } = await supabase.from("listing_images").insert(
    uploads.map((upload) => ({ listing_id: created.id, ...upload })),
  );

  if (imageInsertError) {
    console.error("Unable to save image records", imageInsertError);
    await supabase.storage.from("listing-photos").remove(uploads.map((item) => item.storage_path));
    await supabase.from("listings").delete().eq("id", created.id);
    return Response.json({ error: "We could not save your photos. Please try again." }, { status: 500 });
  }

  return Response.json(
    {
      listing: serializeRow({ ...created, listing_images: uploads }, supabase),
      message: "Your listing is live.",
    },
    { status: 201 },
  );
}

function serializeRow(row: any, supabase: Awaited<ReturnType<typeof createClient>>) {
  const images = (row.listing_images ?? [])
    .slice()
    .sort((a: any, b: any) => a.position - b.position)
    .map((img: any) => supabase.storage.from("listing-photos").getPublicUrl(img.storage_path).data.publicUrl);

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
    color: row.color,
    engine: row.engine,
    description: row.description,
    features: row.features ?? [],
    status: row.status,
    images,
    sellerName: row.seller_name,
    sellerPhone: row.seller_phone,
    sellerEmail: row.seller_email,
    sellerTelegram: row.seller_telegram,
    createdAt: row.created_at,
  };
}
