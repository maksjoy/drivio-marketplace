import { AdminNav } from "@/components/admin-nav";
import { requireAdmin } from "@/lib/admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { supabase } = await requireAdmin();
  const [{ count: openReports }, { count: pendingListings }] = await Promise.all([
    supabase.from("listing_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  return (
    <div className="min-w-0 md:grid md:grid-cols-[220px_minmax(0,1fr)] md:gap-6">
      <AdminNav counts={{ reports: openReports ?? 0, review: pendingListings ?? 0 }} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
