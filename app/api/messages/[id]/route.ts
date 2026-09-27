import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const MAX_MESSAGES_PER_HOUR = 20;
const MAX_MESSAGES_PER_DAY = 100;
const messageSchema = z.object({ body: z.string().trim().min(1).max(1000) });
type RouteContext = { params: Promise<{ id: string }> };

const LINK_PATTERN = /(?:https?:\/\/|www\.|t\.me\/|wa\.me\/|discord\.gg\/|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|ca|net|org|io|co|me|app|xyz|info|biz|dev|ai|ly|gg)(?:[\/?#:\s]|$))/i;

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const { data: conversation } = await supabase.from("conversations")
    .select("id,buyer_id,seller_id")
    .eq("id", id)
    .maybeSingle();
  if (!conversation) return Response.json({ error: "Conversation not found." }, { status: 404 });

  await supabase.rpc("mark_conversation_read", { target_conversation: id });

  const { data, error } = await supabase.from("messages")
    .select("id,sender_id,body,created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) return Response.json({ error: "Could not load messages." }, { status: 503 });

  return Response.json({ messages: data ?? [], currentUserId: user.id });
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const parsed = messageSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Message must be between 1 and 1000 characters." }, { status: 400 });
  if (LINK_PATTERN.test(parsed.data.body)) {
    return Response.json({ error: "Links are not allowed in P2PCars messages for your safety." }, { status: 400 });
  }

  const { data: conversation } = await supabase.from("conversations")
    .select("id,buyer_id,seller_id")
    .eq("id", id)
    .maybeSingle();
  if (!conversation) return Response.json({ error: "Conversation not found." }, { status: 404 });

  const now = Date.now();
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const [hourResult, dayResult] = await Promise.all([
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("sender_id", user.id).gte("created_at", hourAgo),
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("sender_id", user.id).gte("created_at", dayAgo),
  ]);
  if (hourResult.error || dayResult.error) {
    return Response.json({ error: "Could not verify the messaging limit." }, { status: 503 });
  }
  if ((hourResult.count ?? 0) >= MAX_MESSAGES_PER_HOUR) {
    return Response.json({ error: `Anti-spam limit reached: maximum ${MAX_MESSAGES_PER_HOUR} messages per hour.` }, { status: 429 });
  }
  if ((dayResult.count ?? 0) >= MAX_MESSAGES_PER_DAY) {
    return Response.json({ error: `Daily anti-spam limit reached: maximum ${MAX_MESSAGES_PER_DAY} messages per 24 hours.` }, { status: 429 });
  }

  const { data, error } = await supabase.from("messages")
    .insert({ conversation_id: id, sender_id: user.id, body: parsed.data.body })
    .select("id,sender_id,body,created_at")
    .single();

  if (error || !data) {
    const message = error?.message || "";
    const blockedLink = message.toLowerCase().includes("messages_body_no_links");
    const hourlyLimit = message.includes("MESSAGE_HOURLY_LIMIT");
    const dailyLimit = message.includes("MESSAGE_DAILY_LIMIT");
    return Response.json({
      error: blockedLink
        ? "Links are not allowed in P2PCars messages for your safety."
        : hourlyLimit
          ? `Anti-spam limit reached: maximum ${MAX_MESSAGES_PER_HOUR} messages per hour.`
          : dailyLimit
            ? `Daily anti-spam limit reached: maximum ${MAX_MESSAGES_PER_DAY} messages per 24 hours.`
            : "Could not send the message.",
    }, { status: hourlyLimit || dailyLimit ? 429 : 400 });
  }

  return Response.json({ message: data }, { status: 201 });
}
