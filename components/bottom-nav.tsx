"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/favorites", label: "Favorites", icon: HeartIcon },
  { href: "/sell", label: "Sell", icon: PlusIcon, primary: true },
  { href: "/account", label: "Account", icon: UserIcon },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-slate-200 bg-white px-2 pt-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] shadow-[0_-7px_22px_rgba(15,23,42,0.12)] md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-4 items-end">
        {items.map(({ href, label, icon: Icon, primary }) => {
          const active = href === "/"
            ? pathname === "/" || pathname.startsWith("/listings/")
            : pathname.startsWith(href);

          if (primary) {
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-1 text-[12px] font-bold text-slate-700"
              >
                <span className={`flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm ring-2 ring-white ${active ? "ring-emerald-100" : ""}`}>
                  <Icon />
                </span>
                <span className={active ? "text-emerald-700" : "text-slate-600"}>{label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 rounded-xl text-[12px] font-semibold transition ${active ? "text-slate-950" : "text-slate-500"}`}
            >
              <span className={`flex h-7 w-8 items-center justify-center rounded-lg ${active ? "bg-slate-100" : ""}`}>
                <Icon />
              </span>
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function HomeIcon() {
  return <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.1"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/></svg>;
}
function HeartIcon() {
  return <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.1"><path d="M20.8 4.9c-2-2-5.2-2-7.2 0L12 6.5l-1.6-1.6a5.1 5.1 0 0 0-7.2 7.2L12 21l8.8-8.9a5.1 5.1 0 0 0 0-7.2Z"/></svg>;
}
function PlusIcon() {
  return <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 6v12M6 12h12"/></svg>;
}
function UserIcon() {
  return <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.1"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-4 3.1-6 7-6s6.2 2 7 6"/></svg>;
}
