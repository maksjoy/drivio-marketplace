import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const { error } = await supabase.from("profiles")
    .update({ system_messages_read_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return Response.json({ error: "Could not mark notifications as read." }, { status: 503 });
  return Response.json({ ok: true });
}
