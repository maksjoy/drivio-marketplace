import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const MAX_REPORTS_PER_HOUR = 10;
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

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: rateError } = await supabase.from("listing_reports")
    .select("id", { count: "exact", head: true })
    .eq("reporter_id", user.id)
    .gte("created_at", oneHourAgo);
  if (rateError) return Response.json({ error: "Could not verify the report limit." }, { status: 503 });
  if ((count ?? 0) >= MAX_REPORTS_PER_HOUR) {
    return Response.json({ error: "Too many reports. Please try again later." }, { status: 429 });
  }

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
