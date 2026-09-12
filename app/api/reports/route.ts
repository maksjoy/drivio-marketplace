import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const reportSchema = z.object({
  listingId: z.string().uuid(),
  reason: z.string().trim().min(3).max(120),
  details: z.string().trim().max(1000).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to report a listing." }, { status: 401 });
  const parsed = reportSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Check the report." }, { status: 400 });
  const { error } = await supabase.from("listing_reports").insert({
    listing_id: parsed.data.listingId,
    reporter_id: user.id,
    reason: parsed.data.reason,
    details: parsed.data.details || null,
    status: "open",
  });
  if (error) {
    const duplicate = error.message.toLowerCase().includes("duplicate");
    return Response.json({ error: duplicate ? "You already reported this listing." : error.message }, { status: 400 });
  }
  return Response.json({ ok: true });
}
