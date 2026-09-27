import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatPriceCAD } from "@/lib/listings";
import { EnableMessageNotifications } from "@/components/enable-message-notifications";

export const revalidate = 0;
export const metadata = { title: "Messages — P2PCars.ca" };

export default async function MessagesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: conversations, error }, { data: profile }] = await Promise.all([
    supabase.from("conversations")
      .select("id,listing_id,buyer_id,seller_id,created_at,updated_at,buyer_unread_count,seller_unread_count,last_message_body,last_message_at,last_sender_id")
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(100),
    supabase.from("profiles").select("system_messages_read_at").eq("id", user.id).maybeSingle(),
  ]);

  if (error) return <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">Could not load messages.</p>;

  const rows = conversations ?? [];
  const listingIds = Array.from(new Set(rows.map((row) => row.listing_id)));
  const participantIds = Array.from(new Set(rows.flatMap((row) => [row.buyer_id, row.seller_id])));
  const readAt = profile?.system_messages_read_at || new Date(0).toISOString();

  const [{ data: listings }, { data: identities }, systemResult, latestSystemResult] = await Promise.all([
    listingIds.length
      ? supabase.from("listings").select("id,make,model,year,price,status").in("id", listingIds)
      : Promise.resolve({ data: [] as any[] }),
    participantIds.length
      ? supabase.from("public_identities").select("user_id,public_id,nickname").in("user_id", participantIds)
      : Promise.resolve({ data: [] as any[] }),
    supabase.from("system_messages").select("id", { count: "exact", head: true }).eq("is_active", true).gt("created_at", readAt),
    supabase.from("system_messages").select("id,title,body,category,created_at").eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const listingMap = new Map((listings ?? []).map((listing: any) => [listing.id, listing]));
  const identityMap = new Map((identities ?? []).map((identity: any) => [identity.user_id, identity]));
  const systemUnread = Number(systemResult.count || 0);
  const latestSystem = latestSystemResult.data;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-950">Messages</h1>
          <p className="text-sm text-slate-500">Private chats use anonymous P2PCars nicknames. Your real name stays private unless you choose to share it.</p>
        </div>
        <div className="flex items-center gap-3">
          <EnableMessageNotifications />
          <Link href="/" className="text-sm font-bold text-emerald-700">Browse cars</Link>
        </div>
      </div>

      {latestSystem && (
        <Link href="/messages/system" className={`mb-4 block rounded-2xl border p-4 shadow-sm transition hover:shadow ${systemUnread > 0 ? "border-emerald-300 bg-emerald-50/60" : "border-prairie-200 bg-white"}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-950 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white">P2PCars</span>
                <p className="truncate font-extrabold text-slate-950">{latestSystem.title}</p>
              </div>
              <p className="mt-2 truncate text-sm text-slate-600">{latestSystem.body}</p>
            </div>
            <div className="flex-none text-right">
              {systemUnread > 0 && <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-red-600 px-2 py-1 text-xs font-extrabold text-white">{systemUnread > 99 ? "99+" : systemUnread}</span>}
              <p className="mt-2 text-xs text-slate-400">{formatInboxDate(latestSystem.created_at)}</p>
            </div>
          </div>
        </Link>
      )}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-prairie-300 bg-white p-8 text-center">
          <p className="font-semibold text-slate-900">No private conversations yet.</p>
          <p className="mt-1 text-sm text-slate-500">Open a vehicle and tap Message seller.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((conversation) => {
            const listing: any = listingMap.get(conversation.listing_id);
            const isSeller = conversation.seller_id === user.id;
            const counterpartId = isSeller ? conversation.buyer_id : conversation.seller_id;
            const identity: any = identityMap.get(counterpartId);
            const unread = isSeller ? Number(conversation.seller_unread_count || 0) : Number(conversation.buyer_unread_count || 0);
            const title = listing ? `${listing.year} ${listing.make} ${listing.model}` : "Vehicle conversation";
            return (
              <Link
                key={conversation.id}
                href={`/messages/${conversation.id}`}
                className={`block rounded-2xl border p-4 shadow-sm transition hover:border-emerald-300 hover:shadow ${unread > 0 ? "border-emerald-300 bg-emerald-50/40" : "border-prairie-200 bg-white"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-extrabold text-slate-950">{title}</p>
                    <p className="mt-1 truncate text-xs font-bold text-slate-500">
                      {identity?.nickname || (isSeller ? "Anonymous buyer" : "Anonymous seller")}
                      {identity?.public_id ? ` · ${formatPublicId(identity.public_id)}` : ""}
                    </p>
                    <p className={`mt-2 truncate text-sm ${unread > 0 ? "font-semibold text-slate-900" : "text-slate-600"}`}>
                      {conversation.last_message_body || "Conversation started — send the first message."}
                    </p>
                  </div>
                  <div className="flex-none text-right">
                    {listing && <p className="text-sm font-extrabold text-emerald-700">{formatPriceCAD(listing.price)}</p>}
                    {unread > 0 && <span className="mt-2 inline-flex min-w-6 items-center justify-center rounded-full bg-red-600 px-2 py-1 text-xs font-extrabold text-white">{unread > 99 ? "99+" : unread}</span>}
                    <p className="mt-2 text-xs text-slate-400">{formatInboxDate(conversation.last_message_at || conversation.updated_at)}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatPublicId(value: string) {
  return `P2P-${String(value).replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

function formatInboxDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric" }).format(date);
}
