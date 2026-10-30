import { AdminActionButton } from "@/components/admin-actions";
import { AdminBroadcastForm } from "@/components/admin-broadcast-form";
import { formatAdminDate, requireAdmin } from "@/lib/admin";

export const revalidate = 0;
export const metadata = { title: "Admin · Broadcasts — Alberta-Cars" };

export default async function BroadcastsPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("system_messages")
    .select("id,title,body,category,created_at,is_active")
    .order("created_at", { ascending: false })
    .limit(100);
  const rows: any[] = data ?? [];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Communications</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Broadcasts</h1>
        <p className="mt-1 text-sm text-muted">Official Alberta Cars updates, safety notices, promotions and welcomes.</p>
      </header>

      <section>
        <h2 className="text-lg font-black text-ink">New broadcast</h2>
        <AdminBroadcastForm />
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-muted">History</p><h2 className="text-lg font-black text-ink">Published messages</h2></div><span className="text-xs font-bold text-muted">{rows.length} shown</span></div>
        <div className="space-y-3">
          {rows.length === 0 && <div className="rounded-2xl border border-dashed border-line-strong bg-white p-10 text-center text-sm text-muted">No broadcasts yet.</div>}
          {rows.map((item) => (
            <article key={item.id} className="rounded-2xl border border-line bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><Category value={item.category} /><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wide ${item.is_active ? "bg-success-soft text-success" : "bg-surface-sunken text-muted"}`}>{item.is_active ? "Live" : "Unpublished"}</span></div>
                  <h3 className="mt-2 text-lg font-black text-ink">{item.title}</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted">{item.body}</p>
                </div>
                <p className="text-xs font-semibold text-muted">{formatAdminDate(item.created_at)}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-surface-sunken pt-3">
                {item.is_active
                  ? <AdminActionButton payload={{ action: "system_message_status", id: item.id, active: false }}>Unpublish</AdminActionButton>
                  : <AdminActionButton payload={{ action: "system_message_status", id: item.id, active: true }}>Publish again</AdminActionButton>}
                <AdminActionButton danger confirmText="Permanently delete this broadcast?" payload={{ action: "system_message_delete", id: item.id }}>Delete</AdminActionButton>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function Category({ value }: { value: string }) {
  const styles: Record<string,string> = { safety: "bg-danger-soft text-danger", promo: "bg-violet-50 text-violet-700", news: "bg-blue-50 text-blue-700", welcome: "bg-amber-50 text-amber-800", info: "bg-surface-sunken text-muted" };
  return <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wide ${styles[value] || styles.info}`}>{value}</span>;
}
