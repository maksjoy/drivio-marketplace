import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const listingStatusAction = z.object({
  action: z.literal("listing_status"),
  id: z.string().uuid(),
  status: z.enum(["active", "removed", "rejected"]),
  reason: z.string().trim().max(1000).optional(),
});

const schema = z.discriminatedUnion("action", [
  listingStatusAction,
  z.object({
    action: z.literal("report_status"),
    id: z.coerce.number().int().positive(),
    status: z.enum(["open", "reviewed", "resolved", "dismissed"]),
    resolution: z.string().trim().max(1000).optional(),
  }),
  z.object({ action: z.literal("report_delete"), id: z.coerce.number().int().positive() }),
  z.object({ action: z.literal("user_block"), id: z.string().uuid(), blocked: z.boolean(), reason: z.string().max(500).optional() }),
  z.object({
    action: z.literal("system_broadcast"),
    title: z.string().trim().min(1).max(120),
    body: z.string().trim().min(1).max(3000),
    category: z.enum(["info", "news", "safety", "promo", "welcome"]),
  }),
  z.object({ action: z.literal("system_message_status"), id: z.string().uuid(), active: z.boolean() }),
  z.object({ action: z.literal("system_message_delete"), id: z.string().uuid() }),
]);

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const { data: admin } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!admin) return Response.json({ error: "Admin access required." }, { status: 403 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Invalid admin action." }, { status: 400 });
  const action = parsed.data;

  if (action.action === "listing_status") {
    if (action.status === "rejected" && !action.reason?.trim()) {
      return Response.json({ error: "Add a rejection reason." }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      status: action.status,
      updated_at: new Date().toISOString(),
    };
    if (action.status === "active") updates.rejection_reason = null;
    if (action.status === "rejected") updates.rejection_reason = action.reason?.trim() || "Rejected by moderator";

    const { data, error } = await supabase.from("listings")
      .update(updates)
      .eq("id", action.id)
      .select("id,status,rejection_reason")
      .single();
    if (error || !data) return Response.json({ error: error?.message || "Listing was not updated." }, { status: 400 });
    return Response.json({ ok: true, listing: data });
  }

  if (action.action === "report_status") {
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { status: action.status };

    if (action.status === "open") {
      Object.assign(updates, {
        reviewed_at: null,
        reviewed_by: null,
        resolution: null,
        resolved_at: null,
        resolved_by: null,
      });
    } else if (action.status === "reviewed") {
      Object.assign(updates, {
        reviewed_at: now,
        reviewed_by: user.id,
        resolution: action.resolution?.trim() || null,
        resolved_at: null,
        resolved_by: null,
      });
    } else {
      Object.assign(updates, {
        reviewed_at: now,
        reviewed_by: user.id,
        resolution: action.resolution?.trim() || (action.status === "dismissed" ? "Dismissed by moderator" : "Problem resolved"),
        resolved_at: now,
        resolved_by: user.id,
      });
    }

    const { data, error } = await supabase.from("listing_reports")
      .update(updates)
      .eq("id", action.id)
      .select("id,status,resolution,reviewed_at,resolved_at")
      .single();
    if (error || !data) return Response.json({ error: error?.message || "Report was not updated." }, { status: 400 });
    return Response.json({ ok: true, report: data });
  }

  if (action.action === "report_delete") {
    const { data: existing, error: readError } = await supabase.from("listing_reports")
      .select("id,status")
      .eq("id", action.id)
      .single();
    if (readError || !existing) return Response.json({ error: "Report not found." }, { status: 404 });
    if (!['resolved', 'dismissed'].includes(existing.status)) {
      return Response.json({ error: "Resolve or dismiss the report before deleting it." }, { status: 400 });
    }
    const { data, error } = await supabase.from("listing_reports")
      .delete()
      .eq("id", action.id)
      .select("id")
      .single();
    if (error || !data) return Response.json({ error: error?.message || "Report was not deleted." }, { status: 400 });
    return Response.json({ ok: true, deletedReportId: data.id });
  }

  if (action.action === "user_block") {
    const { error } = await supabase.rpc("admin_set_user_block", {
      target_user: action.id,
      blocked: action.blocked,
      block_reason: action.reason || null,
      until_time: null,
    });
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ ok: true });
  }

  if (action.action === "system_message_status") {
    const { data, error } = await supabase.from("system_messages")
      .update({ is_active: action.active })
      .eq("id", action.id)
      .select("id,is_active")
      .single();
    if (error || !data) return Response.json({ error: error?.message || "Broadcast was not updated." }, { status: 400 });
    return Response.json({ ok: true, message: data });
  }

  if (action.action === "system_message_delete") {
    const { data, error } = await supabase.from("system_messages")
      .delete()
      .eq("id", action.id)
      .select("id")
      .single();
    if (error || !data) return Response.json({ error: error?.message || "Broadcast was not deleted." }, { status: 400 });
    return Response.json({ ok: true, deletedMessageId: data.id });
  }

  const { data, error } = await supabase.from("system_messages").insert({
    title: action.title,
    body: action.body,
    category: action.category,
    created_by: user.id,
    is_active: true,
  }).select("id,created_at").single();
  if (error || !data) return Response.json({ error: error?.message || "Could not send broadcast." }, { status: 400 });
  return Response.json({ ok: true, broadcastId: data.id, createdAt: data.created_at });
}
