import { createClient } from "@/lib/supabase/server";

async function userAndListing(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, listingId: "" };
  const body = await request.json().catch(() => ({}));
  return { supabase, user, listingId: String(body.listingId || "") };
}

export async function POST(request: Request) {
  const { supabase, user, listingId } = await userAndListing(request);
  if (!user) return Response.json({ error: "Sign in first." }, { status: 401 });
  if (!listingId) return Response.json({ error: "Listing is required." }, { status: 400 });
  const { error } = await supabase.from("favorites").insert({ user_id: user.id, listing_id: listingId });
  if (error && !error.message.toLowerCase().includes("duplicate")) return Response.json({ error: "Could not save favorite." }, { status: 400 });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { supabase, user, listingId } = await userAndListing(request);
  if (!user) return Response.json({ error: "Sign in first." }, { status: 401 });
  if (!listingId) return Response.json({ error: "Listing is required." }, { status: 400 });
  const { error } = await supabase.from("favorites").delete().eq("user_id", user.id).eq("listing_id", listingId);
  if (error) return Response.json({ error: "Could not remove favorite." }, { status: 400 });
  return Response.json({ ok: true });
}
