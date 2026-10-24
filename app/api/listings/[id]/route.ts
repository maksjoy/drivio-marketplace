import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { listingColumns, listingEditSchema } from "@/lib/listing-schema";
import { listingWriteError } from "@/lib/listing-write";
import { enforceSlidingRateLimit, LISTING_PATCH_RATE_LIMIT, LISTING_PATCH_RATE_PREFIX, rateLimitResponse } from "@/lib/sliding-rate-limit";

const soldPatchSchema = z.object({ status: z.literal("sold") }).strict();
type RouteContext = { params: Promise<{ id: string }> };

const SAFE_LISTING_SELECT = "id,seller_name,make,model,year,price,mileage,body_type,transmission,fuel,drivetrain,city,color,engine,engine_l,power_hp,description,features,status,sold_at,created_at,listing_images(storage_path,thumb_path,position)" as const;
const OWNER_LISTING_SELECT = "id,user_id,seller_name,make,model,year,price,mileage,body_type,transmission,fuel,drivetrain,city,color,engine,engine_l,power_hp,description,features,status,sold_at,created_at,listing_images(storage_path,thumb_path,position)" as const;

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // Anonymous requests must not ask for user_id. That column is revoked from the anon role.
  const { data, error } = await (supabase.from("listings")
    .select(user ? OWNER_LISTING_SELECT : SAFE_LISTING_SELECT).eq("id", id).single() as unknown as Promise<{ data: any; error: { message: string } | null }>);
  if (error || !data) return Response.json({ error: "Listing not found." }, { status: 404 });

  const isOwner = Boolean(user && data.user_id === user.id);
  if (!["active", "sold"].includes(data.status) && !isOwner) return Response.json({ error: "Listing not found." }, { status: 404 });

  const rows = (data.listing_images ?? []).slice().sort((a: any, b: any) => a.position - b.position);
  const paths = rows.map((image: any) => image.storage_path).filter(Boolean);
  const { data: signed } = paths.length
    ? await supabase.storage.from("listing-photos").createSignedUrls(paths, 3600)
    : { data: [] as { signedUrl: string }[] };

  return Response.json({ listing: {
    id: data.id, make: data.make, model: data.model, year: data.year, price: data.price,
    mileage: data.mileage, bodyType: data.body_type, transmission: data.transmission, fuel: data.fuel,
    drivetrain: data.drivetrain, city: data.city, color: data.color, engine: data.engine,
    engineL: data.engine_l, powerHp: data.power_hp,
    description: data.description, features: data.features ?? [], status: data.status, soldAt: data.sold_at,
    images: (signed ?? []).map((item: any) => item.signedUrl).filter(Boolean),
    sellerName: data.seller_name,
    createdAt: data.created_at, isOwner,
  }});
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const limit = await enforceSlidingRateLimit({
    prefix: LISTING_PATCH_RATE_PREFIX,
    identifier: user.id,
    tokens: LISTING_PATCH_RATE_LIMIT.tokens,
    window: LISTING_PATCH_RATE_LIMIT.window,
  });
  if (limit.limited) return rateLimitResponse(limit.retryAfterSeconds);

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return Response.json({ error: "Check the listing details." }, { status: 400 });
  }

  const { data: existing } = await supabase.from("listings").select("user_id,status").eq("id", id).single();
  if (!existing || existing.user_id !== user.id) return Response.json({ error: "Listing not found." }, { status: 404 });
  if (existing.status === "sold") return Response.json({ error: "Sold listings cannot be edited." }, { status: 400 });

  const sold = soldPatchSchema.safeParse(payload);
  if (sold.success) {
    const { error } = await supabase.from("listings").update({ status: "sold" }).eq("id", id);
    if (error) {
      console.error("Unable to mark listing sold", error);
      const mapped = listingWriteError(error, "Could not update the listing.");
      return Response.json({ error: mapped.message }, { status: mapped.status });
    }
    return Response.json({ ok: true });
  }

  const edit = listingEditSchema.safeParse(payload);
  if (!edit.success) return Response.json({ error: edit.error.issues[0]?.message ?? "Check the listing details." }, { status: 400 });

  const { error } = await supabase.from("listings").update({
    ...listingColumns(edit.data),
    status: "pending",
  }).eq("id", id);
  if (error) {
    console.error("Unable to update listing", error);
    const mapped = listingWriteError(error, "Could not update the listing.");
    return Response.json({ error: mapped.message }, { status: mapped.status });
  }
  return Response.json({ ok: true, status: "pending" });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const { data: existing } = await supabase.from("listings")
    .select("user_id, status, listing_images(storage_path, thumb_path)").eq("id", id).single();
  if (!existing || existing.user_id !== user.id) return Response.json({ error: "Listing not found." }, { status: 404 });

  if (existing.status === "active") {
    const { error: removeStateError } = await supabase.from("listings").update({ status: "removed" }).eq("id", id);
    if (removeStateError) return Response.json({ error: "Could not remove the listing." }, { status: 500 });
  }

  const paths = (existing.listing_images ?? []).flatMap((image: any) => [image.storage_path, image.thumb_path])
    .filter((path: unknown): path is string => typeof path === "string" && path.length > 0);
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from("listing-photos").remove(paths);
    if (storageError) return Response.json({ error: "Could not remove listing photos. Please try again." }, { status: 500 });
  }

  const { error } = await supabase.from("listings").delete().eq("id", id);
  if (error) return Response.json({ error: "Could not delete the listing." }, { status: 500 });
  return Response.json({ ok: true });
}
