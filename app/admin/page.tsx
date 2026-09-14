import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminActionButton } from "@/components/admin-actions";

export const revalidate = 0;
export const metadata = { title: "Admin — P2PCars.ca" };

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: admin } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!admin) redirect("/account");

  const [statsResult, usersResult, reportsResult, listingsResult, activityResult] = await Promise.all([
    supabase.rpc("admin_dashboard_stats"),
    supabase.rpc("admin_users"),
    supabase.rpc("admin_listing_reports"),
    supabase.from("listings").select("id,user_id,make,model,year,price,status,seller_name,created_at").order("created_at", { ascending: false }).limit(200),
    supabase.rpc("admin_recent_activity"),
  ]);
  const stats: any = statsResult.data ?? {};
  const users: any[] = usersResult.data ?? [];
  const reports: any[] = reportsResult.data ?? [];
  const listings: any[] = listingsResult.data ?? [];
  const activity: any[] = activityResult.data ?? [];

  const reportCards = await Promise.all(reports.map(async (report) => {
    let imageUrl: string | null = null;
    if (report.image_path) {
      const { data } = await supabase.storage.from("listing-photos").createSignedUrl(report.image_path, 1800);
      imageUrl = data?.signedUrl ?? null;
    }
    return { report, imageUrl };
  }));

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-wider text-red-600">Owner access</p><h1 className="text-3xl font-semibold">P2PCars Admin</h1></div>
        <Link href="/" className="text-sm underline">Back to marketplace</Link>
      </div>

      <section>
        <h2 className="text-xl font-semibold">Overview</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-6">
          <Stat label="Users" value={stats.users} />
          <Stat label="Listings" value={stats.listings} />
          <Stat label="Active" value={stats.activeListings} />
          <Stat label="Open reports" value={stats.openReports} />
          <Stat label="Views" value={stats.views} />
          <Stat label="Blocked" value={stats.blockedUsers} />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Reports</h2>
        <div className="mt-4 space-y-3">
          {reportCards.length === 0 && <p className="text-sm text-prairie-600">No reports.</p>}
          {reportCards.map(({ report, imageUrl }) => (
            <article key={report.report_id} className="grid gap-4 rounded-2xl border border-prairie-200 bg-white p-4 sm:grid-cols-[120px_1fr]">
              <div className="aspect-[4/3] overflow-hidden rounded-lg bg-prairie-100">{imageUrl && <img src={imageUrl} alt="Reported vehicle" className="h-full w-full object-cover" />}</div>
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2"><strong>{report.reason}</strong><span className="rounded-full bg-prairie-100 px-2 py-1 text-xs">{report.report_status}</span></div>
                {report.details && <p className="mt-2 text-sm">{report.details}</p>}
                <p className="mt-2 text-sm text-prairie-600">{report.listing_year} {report.listing_make} {report.listing_model} · ${Number(report.listing_price).toLocaleString()} · {report.listing_status}</p>
                <p className="text-xs text-prairie-500">Reported by: {report.reporter_name || "User"}{report.reporter_email ? ` · ${report.reporter_email}` : ""}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/listings/${report.listing_id}`} className="rounded-full border border-prairie-300 px-3 py-1.5 text-xs font-semibold">Open listing</Link>
                  <AdminActionButton payload={{ action: "report_status", id: report.report_id, status: "reviewed" }}>Reviewed</AdminActionButton>
                  <AdminActionButton payload={{ action: "report_status", id: report.report_id, status: "dismissed" }}>Dismiss</AdminActionButton>
                  <AdminActionButton danger confirmText="Remove this listing from public view?" payload={{ action: "listing_status", id: report.listing_id, status: "removed" }}>Remove listing</AdminActionButton>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Listings</h2>
        <div className="mt-4 space-y-2">
          {listings.map((listing) => (
            <div key={listing.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-prairie-200 bg-white p-3">
              <div><Link className="font-semibold underline" href={`/listings/${listing.id}`}>{listing.year} {listing.make} {listing.model}</Link><p className="text-xs text-prairie-500">{listing.seller_name} · ${Number(listing.price).toLocaleString()} · {listing.status}</p></div>
              <div className="flex gap-2">
                {listing.status !== "active" && <AdminActionButton payload={{ action: "listing_status", id: listing.id, status: "active" }}>Activate</AdminActionButton>}
                {listing.status !== "removed" && <AdminActionButton danger confirmText="Remove this listing?" payload={{ action: "listing_status", id: listing.id, status: "removed" }}>Remove</AdminActionButton>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Users</h2>
        <div className="mt-4 space-y-2">
          {users.map((person) => (
            <div key={person.user_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-prairie-200 bg-white p-3">
              <div><strong>{person.display_name || "User"}</strong><p className="text-xs text-prairie-500">{person.email || "No email"} · {person.listings_count} listings · {person.reports_received} reports{person.is_blocked ? " · BLOCKED" : ""}</p></div>
              {person.is_blocked
                ? <AdminActionButton payload={{ action: "user_block", id: person.user_id, blocked: false }}>Unblock</AdminActionButton>
                : <AdminActionButton danger confirmText="Block this user and remove their active listings?" payload={{ action: "user_block", id: person.user_id, blocked: true, reason: "Marketplace policy violation" }}>Block</AdminActionButton>}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Recent activity</h2>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {activity.map((event, index) => <div key={`${event.day}-${event.event_name}-${index}`} className="rounded-xl bg-prairie-100 p-3 text-sm"><strong>{event.event_name} × {Number(event.event_count).toLocaleString()}</strong><p className="text-xs text-prairie-500">{event.day} · {event.path || "/"}</p></div>)}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: unknown }) {
  return <div className="rounded-xl border border-prairie-200 bg-white p-3"><p className="text-xs text-prairie-500">{label}</p><p className="mt-1 text-xl font-semibold">{Number(value || 0).toLocaleString()}</p></div>;
}
