import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const MAX_NEW_CONVERSATIONS_PER_HOUR = 10;
const requestSchema = z.object({ listingId: z.string().uuid() });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to message the seller." }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Invalid listing." }, { status: 400 });

  const listingId = parsed.data.listingId;
  const { data: existing } = await supabase.from("conversations")
    .select("id")
    .eq("listing_id", listingId)
    .eq("buyer_id", user.id)
    .maybeSingle();
  if (existing?.id) return Response.json({ conversationId: existing.id });

  const { data: listing, error: listingError } = await supabase.from("listings")
    .select("id,user_id,status")
    .eq("id", listingId)
    .eq("status", "active")
    .maybeSingle();
  if (listingError || !listing) return Response.json({ error: "Listing not found." }, { status: 404 });
  if (listing.user_id === user.id) return Response.json({ error: "This is your own listing." }, { status: 400 });

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: rateError } = await supabase.from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("buyer_id", user.id)
    .gte("created_at", oneHourAgo);
  if (rateError) return Response.json({ error: "Could not verify the messaging limit." }, { status: 503 });
  if ((count ?? 0) >= MAX_NEW_CONVERSATIONS_PER_HOUR) {
    return Response.json({ error: "Too many new conversations. Please try again later." }, { status: 429 });
  }

  const { data: created, error } = await supabase.from("conversations")
    .insert({ listing_id: listing.id, buyer_id: user.id, seller_id: listing.user_id })
    .select("id")
    .single();

  if (error || !created) {
    const { data: raced } = await supabase.from("conversations")
      .select("id")
      .eq("listing_id", listingId)
      .eq("buyer_id", user.id)
      .maybeSingle();
    if (raced?.id) return Response.json({ conversationId: raced.id });
    return Response.json({ error: "Could not start a conversation." }, { status: 500 });
  }

  return Response.json({ conversationId: created.id }, { status: 201 });
}
