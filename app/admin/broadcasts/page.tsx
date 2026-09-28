import { AdminActionButton } from "@/components/admin-actions";
import { AdminBroadcastForm } from "@/components/admin-broadcast-form";
import { formatAdminDate, requireAdmin } from "@/lib/admin";

export const revalidate = 0;
export const metadata = { title: "Broadcasts — Alberta Cars Admin" };

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
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Communications</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Broadcasts</h1>
        <p className="mt-1 text-sm text-slate-500">Official Alberta Cars updates, safety notices, promotions and welcomes.</p>
      </header>

      <section>
        <h2 className="text-lg font-black text-slate-950">New broadcast</h2>
        <AdminBroadcastForm />
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-slate-400">History</p><h2 className="text-lg font-black text-slate-950">Published messages</h2></div><span className="text-xs font-bold text-slate-400">{rows.length} shown</span></div>
        <div className="space-y-3">
          {rows.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No broadcasts yet.</div>}
          {rows.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><Category value={item.category} /><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wide ${item.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{item.is_active ? "Live" : "Unpublished"}</span></div>
                  <h3 className="mt-2 text-lg font-black text-slate-950">{item.title}</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.body}</p>
                </div>
                <p className="text-xs font-semibold text-slate-400">{formatAdminDate(item.created_at)}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
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
  const styles: Record<string,string> = { safety: "bg-red-50 text-red-700", promo: "bg-violet-50 text-violet-700", news: "bg-blue-50 text-blue-700", welcome: "bg-amber-50 text-amber-800", info: "bg-slate-100 text-slate-600" };
  return <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wide ${styles[value] || styles.info}`}>{value}</span>;
}
