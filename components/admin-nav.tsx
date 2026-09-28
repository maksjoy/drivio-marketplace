"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Counts = { reports: number; review: number };

const items = [
  { href: "/admin", label: "Dashboard", icon: "▦" },
  { href: "/admin/reports", label: "Reports", icon: "⚑", badge: "reports" as const },
  { href: "/admin/review", label: "Review", icon: "✓", badge: "review" as const },
  { href: "/admin/listings", label: "Listings", icon: "▤" },
  { href: "/admin/users", label: "Users", icon: "◉" },
  { href: "/admin/broadcasts", label: "Broadcasts", icon: "◫" },
];

export function AdminNav({ counts }: { counts: Counts }) {
  const pathname = usePathname();

  return (
    <>
      <nav className="sticky top-[73px] z-20 -mx-4 mb-5 overflow-x-auto border-y border-slate-200 bg-white/95 px-4 py-2 backdrop-blur md:hidden" aria-label="Admin navigation">
        <div className="flex min-w-max gap-2">
          {items.map((item) => {
            const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            const badge = item.badge ? counts[item.badge] : 0;
            return (
              <Link key={item.href} href={item.href} className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold ${active ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"}`}>
                <span>{item.label}</span>
                {badge > 0 && <span className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] ${active ? "bg-white text-slate-950" : "bg-red-600 text-white"}`}>{badge > 99 ? "99+" : badge}</span>}
              </Link>
            );
          })}
        </div>
      </nav>

      <aside className="hidden md:block">
        <div className="sticky top-24 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="border-b border-slate-100 px-3 pb-3 pt-1">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-red-600">Owner console</p>
            <p className="mt-1 text-lg font-black text-slate-950">Alberta Cars</p>
          </div>
          <nav className="mt-2 space-y-1" aria-label="Admin navigation">
            {items.map((item) => {
              const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
              const badge = item.badge ? counts[item.badge] : 0;
              return (
                <Link key={item.href} href={item.href} className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-bold transition ${active ? "bg-slate-950 text-white" : "text-slate-700 hover:bg-slate-100"}`}>
                  <span className="flex items-center gap-3"><span className="w-4 text-center text-xs opacity-70">{item.icon}</span>{item.label}</span>
                  {badge > 0 && <span className={`min-w-6 rounded-full px-1.5 py-0.5 text-center text-[10px] ${active ? "bg-white text-slate-950" : "bg-red-600 text-white"}`}>{badge > 99 ? "99+" : badge}</span>}
                </Link>
              );
            })}
          </nav>
          <div className="mt-3 border-t border-slate-100 pt-3">
            <Link href="/" className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900">← Marketplace</Link>
          </div>
        </div>
      </aside>
    </>
  );
}
