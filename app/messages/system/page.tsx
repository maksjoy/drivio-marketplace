import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SystemMessageFeed } from "@/components/system-message-feed";

export const revalidate = 0;
export const metadata = { title: "Updates · Messages — Alberta-Cars" };

export default async function SystemMessagesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fmessages%2Fsystem");

  const { data: messages, error } = await supabase.from("system_messages")
    .select("id,title,body,category,created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5">
        <Link href="/messages" className="text-sm font-bold text-success">← Messages</Link>
        <div className="mt-3 rounded-2xl bg-ink p-5 text-white">
          <p className="text-xs font-extrabold uppercase tracking-widest text-success-soft">Official channel</p>
          <h1 className="mt-1 text-2xl font-extrabold">Alberta Cars Updates</h1>
          <p className="mt-2 text-sm leading-6 text-line-strong">Safety tips, marketplace news, important notices and promotions from Alberta Cars. Official messages in this channel are sent only by the marketplace admin.</p>
        </div>
      </div>

      {error
        ? <p className="rounded-xl bg-danger-soft p-4 text-sm text-danger">Could not load Alberta Cars updates.</p>
        : <SystemMessageFeed messages={messages ?? []} />}
    </div>
  );
}
