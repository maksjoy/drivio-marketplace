import { AdminActionButton } from "@/components/admin-actions";
import { formatAdminDate, requireAdmin } from "@/lib/admin";

export const revalidate = 0;
export const metadata = { title: "Users — Alberta Cars Admin" };

type PageProps = { searchParams: Promise<{ q?: string }> };

export default async function UsersAdminPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const query = (q || "").trim().toLowerCase();
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_users");
  const users: any[] = (data ?? []).filter((person: any) => {
    if (!query) return true;
    return [person.display_name, person.email, person.phone].some((value) => String(value || "").toLowerCase().includes(query));
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Account operations</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Users</h1>
        <p className="mt-1 text-sm text-slate-500">Seller history, reports and moderation state.</p>
      </header>

      <form className="flex gap-2" action="/admin/users">
        <input name="q" defaultValue={q || ""} placeholder="Search nickname, email or phone…" className="input min-w-0 flex-1" />
        <button className="rounded-full bg-slate-950 px-5 py-2 text-sm font-black text-white">Search</button>
      </form>

      {error && <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">Could not load users.</div>}
      <section className="space-y-3">
        {users.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No users match this search.</div>}
        {users.map((person) => (
          <article key={person.user_id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-black text-slate-950">{person.display_name || "User"}</h2>
                  {person.is_blocked && <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-red-700">Blocked</span>}
                </div>
                <p className="mt-1 break-all text-sm text-slate-500">{person.email || "No email"}{person.phone ? ` · ${person.phone}` : ""}</p>
                <p className="mt-1 text-xs text-slate-400">Joined {formatAdminDate(person.created_at)} · Last sign-in {formatAdminDate(person.last_sign_in_at)}</p>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:min-w-[300px]">
                <Metric label="Listings" value={person.listings_count} />
                <Metric label="Active" value={person.active_listings_count} />
                <Metric label="Reports" value={person.reports_received} />
              </div>
            </div>

            {(person.block_reason || person.blocked_until) && <div className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700"><strong>Moderation:</strong> {person.block_reason || "Blocked"}{person.blocked_until ? ` · until ${formatAdminDate(person.blocked_until)}` : ""}</div>}

            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
              {person.is_blocked
                ? <AdminActionButton payload={{ action: "user_block", id: person.user_id, blocked: false }}>Unblock user</AdminActionButton>
                : <AdminActionButton danger confirmText="Block this user and remove their active/pending listings?" payload={{ action: "user_block", id: person.user_id, blocked: true, reason: "Marketplace policy violation" }}>Block user</AdminActionButton>}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: unknown }) {
  return <div className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-lg font-black text-slate-900">{Number(value || 0).toLocaleString()}</p></div>;
}
