import Link from "next/link";
import { AdminActionButton } from "@/components/admin-actions";
import { formatAdminDate, requireAdmin } from "@/lib/admin";

export const revalidate = 0;
export const metadata = { title: "Listings — Alberta Cars Admin" };

type PageProps = { searchParams: Promise<{ status?: string }> };
const statuses = ["active", "pending", "sold", "removed", "rejected"] as const;

export default async function ListingsAdminPage({ searchParams }: PageProps) {
  const { status: rawStatus } = await searchParams;
  const selected = statuses.includes(rawStatus as any) ? String(rawStatus) : "active";
  const { supabase } = await requireAdmin();

  const [{ data: rows }, { data: allStatuses }] = await Promise.all([
    supabase.from("listings")
      .select("id,user_id,seller_name,make,model,year,price,mileage,city,status,rejection_reason,created_at,updated_at")
      .eq("status", selected)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase.from("listings").select("status"),
  ]);

  const listings: any[] = rows ?? [];
  const statusRows: any[] = allStatuses ?? [];
  const counts = Object.fromEntries(statuses.map((status) => [status, statusRows.filter((row) => row.status === status).length])) as Record<string, number>;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Inventory operations</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Listings</h1>
        <p className="mt-1 text-sm text-slate-500">Manage marketplace inventory by state without mixing it into reports.</p>
      </header>

      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Listing status filters">
        {statuses.map((status) => (
          <Link key={status} href={`/admin/listings?status=${status}`} className={`flex min-w-max items-center gap-2 rounded-full px-4 py-2 text-sm font-black ${selected === status ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>
            <span className="capitalize">{status}</span><span className={`rounded-full px-2 py-0.5 text-[10px] ${selected === status ? "bg-white text-slate-950" : "bg-slate-100 text-slate-600"}`}>{counts[status] ?? 0}</span>
          </Link>
        ))}
      </nav>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {listings.length === 0 && <div className="p-10 text-center text-sm text-slate-500">No {selected} listings.</div>}
        <div className="divide-y divide-slate-100">
          {listings.map((listing) => (
            <div key={listing.id} className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-black text-slate-950">{listing.year} {listing.make} {listing.model}</h2>
                  <Status value={listing.status} />
                </div>
                <p className="mt-1 text-sm text-slate-500">{listing.seller_name} · ${Number(listing.price).toLocaleString()} · {Number(listing.mileage).toLocaleString()} km · {listing.city || "Alberta"}</p>
                <p className="mt-1 text-xs text-slate-400">Created {formatAdminDate(listing.created_at)} · Updated {formatAdminDate(listing.updated_at)}</p>
                {listing.rejection_reason && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{listing.rejection_reason}</p>}
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                {["active", "sold"].includes(listing.status) && <Link href={`/listings/${listing.id}`} className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-black text-slate-700">Open</Link>}
                {listing.status === "pending" && <Link href="/admin/review" className="rounded-full border border-blue-300 px-3 py-1.5 text-xs font-black text-blue-700">Review queue</Link>}
                {["removed", "rejected"].includes(listing.status) && <AdminActionButton payload={{ action: "listing_status", id: listing.id, status: "active" }}>Restore active</AdminActionButton>}
                {listing.status !== "removed" && <AdminActionButton danger confirmText="Remove this listing from public view?" payload={{ action: "listing_status", id: listing.id, status: "removed" }}>Remove</AdminActionButton>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Status({ value }: { value: string }) {
  const styles: Record<string,string> = { active: "bg-emerald-50 text-emerald-700", pending: "bg-blue-50 text-blue-700", sold: "bg-slate-100 text-slate-700", removed: "bg-red-50 text-red-700", rejected: "bg-amber-50 text-amber-800" };
  return <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wide ${styles[value] || "bg-slate-100 text-slate-600"}`}>{value}</span>;
}
