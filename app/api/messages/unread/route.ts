import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ totalUnread: 0, personalUnread: 0, systemUnread: 0, latest: null }, { status: 401 });

  const [{ data: conversations, error: conversationsError }, { data: profile, error: profileError }] = await Promise.all([
    supabase.from("conversations")
      .select("id,buyer_id,seller_id,buyer_unread_count,seller_unread_count,last_message_body,last_message_at,last_sender_id")
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(100),
    supabase.from("profiles").select("system_messages_read_at").eq("id", user.id).maybeSingle(),
  ]);

  if (conversationsError || profileError) return Response.json({ error: "Could not load unread messages." }, { status: 503 });

  const rows = conversations ?? [];
  let personalUnread = 0;
  let latestPersonal: null | { key: string; title: string; body: string; href: string; at: string } = null;

  for (const conversation of rows) {
    const unread = conversation.buyer_id === user.id ? Number(conversation.buyer_unread_count || 0) : Number(conversation.seller_unread_count || 0);
    personalUnread += unread;
    if (!latestPersonal && unread > 0 && conversation.last_message_at) {
      latestPersonal = {
        key: `conversation:${conversation.id}:${conversation.last_message_at}`,
        title: "New Alberta Cars message",
        body: String(conversation.last_message_body || "You have a new private message.").slice(0, 180),
        href: `/messages/${conversation.id}`,
        at: conversation.last_message_at,
      };
    }
  }

  const readAt = profile?.system_messages_read_at || new Date(0).toISOString();
  const { data: systemRows, count: systemUnread, error: systemError } = await supabase.from("system_messages")
    .select("id,title,body,created_at", { count: "exact" })
    .eq("is_active", true)
    .gt("created_at", readAt)
    .order("created_at", { ascending: false })
    .limit(1);

  if (systemError) return Response.json({ error: "Could not load system notifications." }, { status: 503 });

  const latestSystemRow = systemRows?.[0];
  const latestSystem = latestSystemRow ? {
    key: `system:${latestSystemRow.id}`,
    title: latestSystemRow.title,
    body: String(latestSystemRow.body || "").slice(0, 180),
    href: "/messages/system",
    at: latestSystemRow.created_at,
  } : null;

  const latest = !latestPersonal ? latestSystem : !latestSystem ? latestPersonal : new Date(latestPersonal.at).getTime() >= new Date(latestSystem.at).getTime() ? latestPersonal : latestSystem;
  const systemCount = Number(systemUnread || 0);
  return Response.json({ totalUnread: personalUnread + systemCount, personalUnread, systemUnread: systemCount, latest }, { headers: { "Cache-Control": "private, no-store" } });
}
