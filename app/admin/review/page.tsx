import { AdminActionButton } from "@/components/admin-actions";
import { AdminRejectListingButton } from "@/components/admin-reject-listing-button";
import { formatAdminDate, requireAdmin } from "@/lib/admin";

export const revalidate = 0;
export const metadata = { title: "Review — Alberta Cars Admin" };

export default async function ReviewPage() {
  const { supabase } = await requireAdmin();
  const [{ data: listings, error }, usersResult] = await Promise.all([
    supabase.from("listings")
      .select("id,user_id,seller_name,make,model,year,price,mileage,fuel,transmission,drivetrain,city,description,features,created_at,listing_images(storage_path,thumb_path,position)")
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    supabase.rpc("admin_users"),
  ]);

  const users: any[] = usersResult.data ?? [];
  const userMap = new Map(users.map((person) => [person.user_id, person]));
  const rows: any[] = listings ?? [];

  const cards = await Promise.all(rows.map(async (listing) => {
    const images = (listing.listing_images ?? []).slice().sort((a: any, b: any) => a.position - b.position);
    const paths = images.slice(0, 4).map((image: any) => image.thumb_path || image.storage_path).filter(Boolean);
    const { data: signed } = paths.length ? await supabase.storage.from("listing-photos").createSignedUrls(paths, 1800) : { data: [] as any[] };
    return { listing, seller: userMap.get(listing.user_id), images: (signed ?? []).map((item: any) => item.signedUrl).filter(Boolean) };
  }));

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Moderation</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Review</h1>
        <p className="mt-1 text-sm text-slate-500">New seller submissions. Review the vehicle and seller signals before publishing.</p>
      </header>

      {error && <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">Could not load the review queue.</div>}
      {cards.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><p className="font-black text-slate-900">Review queue is clear.</p><p className="mt-1 text-sm text-slate-500">No new listings are waiting for approval.</p></div>}

      <section className="space-y-4">
        {cards.map(({ listing, seller, images }) => (
          <article key={listing.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="grid gap-0 lg:grid-cols-[300px_minmax(0,1fr)]">
              <div className="grid min-h-52 grid-cols-2 gap-1 bg-slate-100 p-1">
                {(images.length ? images : [null]).map((url: string | null, index: number) => (
                  <div key={`${listing.id}-${index}`} className={`${index === 0 && images.length < 2 ? "col-span-2" : ""} min-h-24 overflow-hidden rounded-lg bg-slate-200`}>
                    {url ? <img src={url} alt={`${listing.year} ${listing.make} ${listing.model}`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs font-bold text-slate-400">No photo</div>}
                  </div>
                ))}
              </div>

              <div className="min-w-0 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-blue-700">Pending review</span>
                    <h2 className="mt-3 text-2xl font-black text-slate-950">{listing.year} {listing.make} {listing.model}</h2>
                    <p className="mt-1 text-xl font-black text-emerald-700">${Number(listing.price).toLocaleString()}</p>
                  </div>
                  <p className="text-xs font-semibold text-slate-400">Submitted {formatAdminDate(listing.created_at)}</p>
                </div>

                <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                  <Metric label="Mileage" value={`${Number(listing.mileage).toLocaleString()} km`} />
                  <Metric label="Fuel" value={listing.fuel || "—"} />
                  <Metric label="Transmission" value={listing.transmission || "—"} />
                  <Metric label="Location" value={listing.city || "Alberta"} />
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-slate-400">Seller</p>
                    <p className="mt-1 font-black text-slate-900">{listing.seller_name}</p>
                    <p className="text-sm text-slate-500">Joined {formatAdminDate(seller?.created_at)}</p>
                    <p className="mt-1 text-xs text-slate-500">{seller?.listings_count ?? 0} total listings · {seller?.active_listings_count ?? 0} active · {seller?.reports_received ?? 0} reports received{seller?.is_blocked ? " · BLOCKED" : ""}</p>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-slate-400">Description</p>
                    <p className="mt-1 line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-slate-600">{listing.description || "No description provided."}</p>
                  </div>
                </div>

                {listing.features?.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{listing.features.map((feature: string) => <span key={feature} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{feature}</span>)}</div>}

                <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  <AdminActionButton payload={{ action: "listing_status", id: listing.id, status: "active" }}>Approve & publish</AdminActionButton>
                  <AdminRejectListingButton listingId={listing.id} />
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 font-bold text-slate-800">{value}</p></div>;
}
