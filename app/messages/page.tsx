import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatPriceCAD } from "@/lib/listings";

export const revalidate = 0;
export const metadata = { title: "Messages — P2PCars.ca" };

export default async function MessagesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: conversations, error } = await supabase.from("conversations")
    .select("id,listing_id,buyer_id,seller_id,created_at,updated_at")
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    return <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">Could not load messages.</p>;
  }

  const rows = conversations ?? [];
  const listingIds = Array.from(new Set(rows.map((row) => row.listing_id)));
  const conversationIds = rows.map((row) => row.id);

  const [{ data: listings }, { data: recentMessages }] = await Promise.all([
    listingIds.length
      ? supabase.from("listings").select("id,make,model,year,price,status").in("id", listingIds)
      : Promise.resolve({ data: [] as any[] }),
    conversationIds.length
      ? supabase.from("messages").select("id,conversation_id,sender_id,body,created_at").in("conversation_id", conversationIds).order("created_at", { ascending: false }).limit(300)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const listingMap = new Map((listings ?? []).map((listing: any) => [listing.id, listing]));
  const lastMessageMap = new Map<string, any>();
  for (const message of recentMessages ?? []) {
    if (!lastMessageMap.has(message.conversation_id)) lastMessageMap.set(message.conversation_id, message);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-950">Messages</h1>
          <p className="text-sm text-slate-500">Private conversations between buyers and sellers.</p>
        </div>
        <Link href="/" className="text-sm font-bold text-emerald-700">Browse cars</Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-prairie-300 bg-white p-8 text-center">
          <p className="font-semibold text-slate-900">No conversations yet.</p>
          <p className="mt-1 text-sm text-slate-500">Open a vehicle and tap Message seller.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((conversation) => {
            const listing: any = listingMap.get(conversation.listing_id);
            const last = lastMessageMap.get(conversation.id);
            const isSeller = conversation.seller_id === user.id;
            const title = listing ? `${listing.year} ${listing.make} ${listing.model}` : "Vehicle conversation";
            return (
              <Link
                key={conversation.id}
                href={`/messages/${conversation.id}`}
                className="block rounded-2xl border border-prairie-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-extrabold text-slate-950">{title}</p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400">{isSeller ? "Buyer inquiry" : "Seller"}</p>
                    <p className="mt-2 truncate text-sm text-slate-600">{last?.body || "Conversation started — send the first message."}</p>
                  </div>
                  <div className="flex-none text-right">
                    {listing && <p className="text-sm font-extrabold text-emerald-700">{formatPriceCAD(listing.price)}</p>}
                    <p className="mt-2 text-xs text-slate-400">{formatInboxDate(last?.created_at || conversation.updated_at)}</p>
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

function formatInboxDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric" }).format(date);
}
