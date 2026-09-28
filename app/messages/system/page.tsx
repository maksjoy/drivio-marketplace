import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SystemMessageFeed } from "@/components/system-message-feed";

export const revalidate = 0;
export const metadata = { title: "P2PCars Updates — Messages" };

export default async function SystemMessagesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: messages, error } = await supabase.from("system_messages")
    .select("id,title,body,category,created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5">
        <Link href="/messages" className="text-sm font-bold text-emerald-700">← Messages</Link>
        <div className="mt-3 rounded-2xl bg-slate-950 p-5 text-white">
          <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-300">Official channel</p>
          <h1 className="mt-1 text-2xl font-extrabold">P2PCars Updates</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">Safety tips, marketplace news, important notices and promotions from P2PCars. Official messages in this channel are sent only by the marketplace admin.</p>
        </div>
      </div>

      {error
        ? <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">Could not load P2PCars updates.</p>
        : <SystemMessageFeed messages={messages ?? []} />}
    </div>
  );
}
