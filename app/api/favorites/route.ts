import { createClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ signedIn: false, favoriteIds: [] }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const raw = new URL(request.url).searchParams.get("listingIds") || "";
  const listingIds = [...new Set(raw.split(",").map((value) => value.trim()).filter((value) => UUID_RE.test(value)))].slice(0, 48);
  if (!listingIds.length) {
    return Response.json({ signedIn: true, favoriteIds: [] }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const { data, error } = await supabase.from("favorites")
    .select("listing_id")
    .eq("user_id", user.id)
    .in("listing_id", listingIds);
  if (error) return Response.json({ error: "Could not load favorites." }, { status: 503 });

  return Response.json(
    { signedIn: true, favoriteIds: (data ?? []).map((favorite) => favorite.listing_id) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

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
  if (!UUID_RE.test(listingId)) return Response.json({ error: "Listing is required." }, { status: 400 });
  const { error } = await supabase.from("favorites").insert({ user_id: user.id, listing_id: listingId });
  if (error && !error.message.toLowerCase().includes("duplicate")) return Response.json({ error: "Could not save favorite." }, { status: 400 });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { supabase, user, listingId } = await userAndListing(request);
  if (!user) return Response.json({ error: "Sign in first." }, { status: 401 });
  if (!UUID_RE.test(listingId)) return Response.json({ error: "Listing is required." }, { status: 400 });
  const { error } = await supabase.from("favorites").delete().eq("user_id", user.id).eq("listing_id", listingId);
  if (error) return Response.json({ error: "Could not remove favorite." }, { status: 400 });
  return Response.json({ ok: true });
}
