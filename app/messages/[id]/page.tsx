import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatPriceCAD } from "@/lib/listings";
import { MessageThread } from "@/components/message-thread";

type PageContext = { params: Promise<{ id: string }> };
export const revalidate = 0;

export default async function ConversationPage(context: PageContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: conversation } = await supabase.from("conversations")
    .select("id,listing_id,buyer_id,seller_id")
    .eq("id", id)
    .maybeSingle();
  if (!conversation) notFound();

  const isSeller = conversation.seller_id === user.id;
  const [{ data: listing }, { data: messages }, profileResult] = await Promise.all([
    supabase.from("listings")
      .select("id,make,model,year,price,status")
      .eq("id", conversation.listing_id)
      .maybeSingle(),
    supabase.from("messages")
      .select("id,sender_id,body,created_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true })
      .limit(200),
    isSeller
      ? supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const vehicleTitle = listing ? `${listing.year} ${listing.make} ${listing.model}` : "Vehicle conversation";
  const sellerPhone = isSeller ? profileResult.data?.phone || null : null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/messages" className="text-sm font-bold text-emerald-700">← Messages</Link>
          <h1 className="mt-2 truncate text-xl font-extrabold text-slate-950">{vehicleTitle}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {listing ? `${formatPriceCAD(listing.price)} · ${isSeller ? "Buyer inquiry" : "Private seller"}` : "Private conversation"}
          </p>
        </div>
        {listing && <Link href={`/listings/${listing.id}`} className="flex-none rounded-full border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700">View car</Link>}
      </div>

      <MessageThread
        conversationId={conversation.id}
        currentUserId={user.id}
        initialMessages={messages ?? []}
        isSeller={isSeller}
        sellerPhone={sellerPhone}
      />
    </div>
  );
}
