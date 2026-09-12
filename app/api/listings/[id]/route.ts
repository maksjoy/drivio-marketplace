import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const patchSchema = z.object({ status: z.enum(["sold", "removed"]) });
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data, error } = await supabase.from("listings")
    .select("*, listing_images(storage_path, thumb_path, position)").eq("id", id).single();
  if (error || !data) return Response.json({ error: "Listing not found." }, { status: 404 });

  const { data: { user } } = await supabase.auth.getUser();
  const isOwner = data.user_id === user?.id;
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
    description: data.description, features: data.features ?? [], status: data.status, soldAt: data.sold_at,
    images: (signed ?? []).map((item: any) => item.signedUrl).filter(Boolean),
    sellerName: data.seller_name, sellerPhone: data.seller_phone, sellerEmail: data.seller_email,
    createdAt: data.created_at, isOwner,
  }});
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const body = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return Response.json({ error: "Owners can only mark a listing as sold or removed." }, { status: 400 });

  const { data: existing } = await supabase.from("listings").select("user_id").eq("id", id).single();
  if (!existing || existing.user_id !== user.id) return Response.json({ error: "Listing not found." }, { status: 404 });

  const { error } = await supabase.from("listings").update({ status: body.data.status }).eq("id", id);
  if (error) return Response.json({ error: error.message || "Could not update the listing." }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const { data: existing } = await supabase.from("listings")
    .select("user_id, listing_images(storage_path, thumb_path)").eq("id", id).single();
  if (!existing || existing.user_id !== user.id) return Response.json({ error: "Listing not found." }, { status: 404 });

  const paths = (existing.listing_images ?? []).flatMap((image: any) => [image.storage_path, image.thumb_path])
    .filter((path: unknown): path is string => typeof path === "string" && path.length > 0);
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from("listing-photos").remove(paths);
    if (storageError) return Response.json({ error: "Could not remove listing photos." }, { status: 500 });
  }
  const { error } = await supabase.from("listings").delete().eq("id", id);
  if (error) return Response.json({ error: "Could not delete the listing." }, { status: 500 });
  return Response.json({ ok: true });
}
