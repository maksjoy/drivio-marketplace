import Link from "next/link";
import { requireAdmin } from "@/lib/admin";

export const revalidate = 0;
export const metadata = { title: "Admin Dashboard — Alberta Cars" };

export default async function AdminPage() {
  const { supabase } = await requireAdmin();
  const [statsResult, activityResult, reportCounts, pendingResult, broadcastResult] = await Promise.all([
    supabase.rpc("admin_dashboard_stats"),
    supabase.rpc("admin_recent_activity"),
    supabase.from("listing_reports").select("status"),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("system_messages").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);

  const stats: any = statsResult.data ?? {};
  const activity: any[] = activityResult.data ?? [];
  const reportRows: any[] = reportCounts.data ?? [];
  const counts = {
    open: reportRows.filter((row) => row.status === "open").length,
    reviewed: reportRows.filter((row) => row.status === "reviewed").length,
    resolved: reportRows.filter((row) => row.status === "resolved").length,
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Operations</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Moderation, marketplace health and admin queues in one place.</p>
        </div>
        <Link href="/" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 md:hidden">Marketplace</Link>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Users" value={stats.users} />
        <Stat label="Active listings" value={stats.activeListings} />
        <Stat label="Listing views" value={stats.views} />
        <Stat label="Blocked users" value={stats.blockedUsers} />
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Queues</p><h2 className="text-xl font-black text-slate-950">Needs attention</h2></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <QueueCard href="/admin/reports?status=open" title="Reports to review" value={counts.open} tone="red" description="New complaints waiting for moderation." />
          <QueueCard href="/admin/reports?status=reviewed" title="Decision pending" value={counts.reviewed} tone="amber" description="Reviewed reports that still need a final outcome." />
          <QueueCard href="/admin/review" title="New listings" value={pendingResult.count ?? 0} tone="blue" description="Seller submissions waiting for approval." />
          <QueueCard href="/admin/broadcasts" title="Active broadcasts" value={broadcastResult.count ?? 0} tone="slate" description="Messages currently visible in Alberta Cars Updates." />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black text-slate-950">Recent marketplace activity</h2>
            <span className="text-xs font-semibold text-slate-400">Last recorded events</span>
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {activity.slice(0, 12).map((event, index) => (
              <div key={`${event.day}-${event.event_name}-${index}`} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0"><p className="truncate font-bold text-slate-800">{event.event_name}</p><p className="truncate text-xs text-slate-400">{event.day} · {event.path || "/"}</p></div>
                <strong className="flex-none text-slate-950">{Number(event.event_count).toLocaleString()}</strong>
              </div>
            ))}
            {activity.length === 0 && <p className="py-5 text-sm text-slate-500">No recent activity.</p>}
          </div>
        </div>

        <div className="rounded-2xl bg-slate-950 p-5 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Moderation snapshot</p>
          <p className="mt-3 text-4xl font-black">{counts.open + (pendingResult.count ?? 0)}</p>
          <p className="mt-1 text-sm text-slate-300">items currently require action</p>
          <div className="mt-6 space-y-3 text-sm">
            <Row label="Open reports" value={counts.open} />
            <Row label="Reviewed reports" value={counts.reviewed} />
            <Row label="Resolved reports" value={counts.resolved} />
            <Row label="Pending listings" value={pendingResult.count ?? 0} />
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: unknown }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-slate-950">{Number(value || 0).toLocaleString()}</p></div>;
}

function QueueCard({ href, title, value, description, tone }: { href: string; title: string; value: number; description: string; tone: "red" | "amber" | "blue" | "slate" }) {
  const tones = { red: "bg-red-50 text-red-700", amber: "bg-amber-50 text-amber-800", blue: "bg-blue-50 text-blue-700", slate: "bg-slate-100 text-slate-700" };
  return <Link href={href} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-center justify-between gap-3"><h3 className="font-black text-slate-950">{title}</h3><span className={`rounded-full px-2.5 py-1 text-sm font-black ${tones[tone]}`}>{value}</span></div><p className="mt-2 text-sm leading-5 text-slate-500">{description}</p><p className="mt-4 text-xs font-black uppercase tracking-wide text-slate-400">Open queue →</p></Link>;
}

function Row({ label, value }: { label: string; value: number }) {
  return <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2"><span className="text-slate-300">{label}</span><strong>{value}</strong></div>;
}
