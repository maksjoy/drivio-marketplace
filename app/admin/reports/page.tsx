import Link from "next/link";
import { AdminActionButton } from "@/components/admin-actions";
import { formatAdminDate, requireAdmin } from "@/lib/admin";

export const revalidate = 0;
export const metadata = { title: "Admin · Reports — Alberta-Cars" };

type PageProps = { searchParams: Promise<{ status?: string }> };

const tabs = [
  { key: "open", label: "To review" },
  { key: "reviewed", label: "Reviewed" },
  { key: "resolved", label: "Problem solved" },
  { key: "dismissed", label: "Dismissed" },
] as const;

export default async function ReportsPage({ searchParams }: PageProps) {
  const { status: rawStatus } = await searchParams;
  const selected = tabs.some((tab) => tab.key === rawStatus) ? rawStatus! : "open";
  const { supabase } = await requireAdmin();

  const [contextResult, metaResult] = await Promise.all([
    supabase.rpc("admin_listing_reports"),
    supabase.from("listing_reports").select("id,status,reviewed_at,reviewed_by,resolution,resolved_at,resolved_by,created_at"),
  ]);

  const contextRows: any[] = contextResult.data ?? [];
  const metaRows: any[] = metaResult.data ?? [];
  const metaMap = new Map(metaRows.map((row) => [Number(row.id), row]));
  const counts = Object.fromEntries(tabs.map((tab) => [tab.key, metaRows.filter((row) => row.status === tab.key).length])) as Record<string, number>;
  const filtered = contextRows
    .map((report) => ({ ...report, ...(metaMap.get(Number(report.report_id)) ?? {}) }))
    .filter((report) => report.status === selected || report.report_status === selected);

  const cards = await Promise.all(filtered.map(async (report) => {
    let imageUrl: string | null = null;
    if (report.image_path) {
      const { data } = await supabase.storage.from("listing-photos").createSignedUrl(report.image_path, 1800);
      imageUrl = data?.signedUrl ?? null;
    }
    return { report, imageUrl };
  }));

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Moderation</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Reports</h1>
        <p className="mt-1 text-sm text-muted">Keep complaints in a clean workflow instead of one endless list.</p>
      </header>

      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Report status filters">
        {tabs.map((tab) => {
          const active = selected === tab.key;
          return (
            <Link key={tab.key} href={`/admin/reports?status=${tab.key}`} className={`flex min-w-max items-center gap-2 rounded-full px-4 py-2 text-sm font-black ${active ? "bg-ink text-white" : "border border-line bg-white text-ink-soft"}`}>
              {tab.label}
              <span className={`rounded-full px-2 py-0.5 text-[10px] ${active ? "bg-white text-ink" : "bg-surface-sunken text-muted"}`}>{counts[tab.key] ?? 0}</span>
            </Link>
          );
        })}
      </nav>

      <section className="space-y-4">
        {cards.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line-strong bg-white p-10 text-center">
            <p className="font-black text-ink">Queue is clear.</p>
            <p className="mt-1 text-sm text-muted">No reports in this status.</p>
          </div>
        )}

        {cards.map(({ report, imageUrl }) => {
          const status = String(report.status || report.report_status);
          const listingRemoved = ["removed", "rejected"].includes(report.listing_status);
          return (
            <article key={report.report_id} className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
              <div className="grid gap-0 md:grid-cols-[190px_minmax(0,1fr)]">
                <div className="aspect-[16/10] bg-surface-sunken md:aspect-auto md:min-h-48">
                  {imageUrl ? <img src={imageUrl} alt="Reported vehicle" width={640} height={480} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs font-bold text-muted">No photo</div>}
                </div>
                <div className="min-w-0 p-4 md:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill status={status} />
                        {listingRemoved && <span className="rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-black text-success">Listing removed</span>}
                      </div>
                      <h2 className="mt-3 text-xl font-black text-ink">{report.reason}</h2>
                      {report.details && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">{report.details}</p>}
                    </div>
                    <p className="text-xs font-semibold text-muted">#{report.report_id} · {formatAdminDate(report.reported_at || report.created_at)}</p>
                  </div>

                  <div className="mt-4 grid gap-3 rounded-xl bg-surface-sunken p-3 text-sm sm:grid-cols-2">
                    <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Vehicle</p><p className="mt-1 font-black text-ink">{report.listing_year} {report.listing_make} {report.listing_model}</p><p className="text-muted">${Number(report.listing_price || 0).toLocaleString()} · {report.listing_status}</p></div>
                    <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Reporter</p><p className="mt-1 font-black text-ink">{report.reporter_name || "User"}</p><p className="break-all text-muted">{report.reporter_email || "No email"}</p></div>
                  </div>

                  {report.resolution && <div className="mt-3 rounded-xl border border-success/20 bg-success-soft p-3"><p className="text-xs font-black uppercase tracking-wide text-success">Resolution</p><p className="mt-1 text-sm text-success-strong">{report.resolution}</p><p className="mt-1 text-xs text-success">{formatAdminDate(report.resolved_at)}</p></div>}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {!listingRemoved && ["active", "sold"].includes(report.listing_status) && <Link href={`/listings/${report.listing_id}`} className="rounded-full border border-line-strong px-3 py-2 text-xs font-black text-ink-soft">Open listing</Link>}
                    {!listingRemoved && <AdminActionButton danger confirmText="Remove this listing from the marketplace?" payload={{ action: "listing_status", id: report.listing_id, status: "removed" }}>Remove listing</AdminActionButton>}
                    {status === "open" && <AdminActionButton payload={{ action: "report_status", id: report.report_id, status: "reviewed" }}>Mark reviewed</AdminActionButton>}
                    {status === "reviewed" && <AdminActionButton payload={{ action: "report_status", id: report.report_id, status: "resolved", resolution: listingRemoved ? "Reported listing was removed from the marketplace." : "Moderator confirmed the problem is resolved." }}>Problem solved</AdminActionButton>}
                    {["open", "reviewed"].includes(status) && <AdminActionButton confirmText="Dismiss this report with no further action?" payload={{ action: "report_status", id: report.report_id, status: "dismissed", resolution: "Report dismissed after moderator review." }}>Dismiss</AdminActionButton>}
                    {["resolved", "dismissed"].includes(status) && <AdminActionButton payload={{ action: "report_status", id: report.report_id, status: "open" }}>Reopen</AdminActionButton>}
                    {["resolved", "dismissed"].includes(status) && <AdminActionButton danger confirmText="Permanently delete this closed report? This cannot be undone." payload={{ action: "report_delete", id: report.report_id }}>Delete report</AdminActionButton>}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: "bg-danger-soft text-danger",
    reviewed: "bg-amber-50 text-amber-800",
    resolved: "bg-success-soft text-success",
    dismissed: "bg-surface-sunken text-muted",
  };
  const labels: Record<string, string> = { open: "To review", reviewed: "Reviewed", resolved: "Problem solved", dismissed: "Dismissed" };
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${styles[status] || "bg-surface-sunken text-muted"}`}>{labels[status] || status}</span>;
}
