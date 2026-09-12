import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("listing_status"), id: z.string().uuid(), status: z.enum(["active", "removed"]) }),
  z.object({ action: z.literal("report_status"), id: z.coerce.number().int().positive(), status: z.enum(["reviewed", "dismissed", "open"]) }),
  z.object({ action: z.literal("user_block"), id: z.string().uuid(), blocked: z.boolean(), reason: z.string().max(500).optional() }),
]);

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { data: admin } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!admin) return Response.json({ error: "Admin access required." }, { status: 403 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Invalid admin action." }, { status: 400 });
  const action = parsed.data;

  if (action.action === "listing_status") {
    const { error } = await supabase.from("listings").update({ status: action.status }).eq("id", action.id);
    if (error) return Response.json({ error: error.message }, { status: 400 });
  } else if (action.action === "report_status") {
    const { error } = await supabase.from("listing_reports").update({ status: action.status }).eq("id", action.id);
    if (error) return Response.json({ error: error.message }, { status: 400 });
  } else {
    const { error } = await supabase.rpc("admin_set_user_block", {
      target_user: action.id,
      blocked: action.blocked,
      block_reason: action.reason || null,
      until_time: null,
    });
    if (error) return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true });
}
