"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SignOutButton } from "@/components/sign-out-button";

export function HeaderMenu({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  function close() {
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open account menu"
        aria-expanded={open}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 shadow-sm transition hover:bg-slate-50 active:scale-[0.97]"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5.5 10.5V20h13v-9.5" />
          <path d="M9 20v-5h6v5" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100]">
          <button type="button" className="absolute inset-0 bg-slate-950/35" aria-label="Close account menu" onClick={close} />
          <aside className="absolute right-0 top-0 flex h-[100dvh] w-[min(88vw,390px)] flex-col overflow-y-auto bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rig-50 text-rig-900">
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                    <circle cx="12" cy="8" r="3.5" />
                    <path d="M5 20c.8-4 3.1-6 7-6s6.2 2 7 6" />
                  </svg>
                </div>
                <div>
                  <p className="text-lg font-extrabold text-slate-950">{signedIn ? "My account" : "Sign in"}</p>
                  <p className="text-xs font-medium text-slate-500">Alberta-Cars</p>
                </div>
              </div>
              <button type="button" onClick={close} aria-label="Close account menu" className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-50 text-slate-900">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </div>

            {!signedIn && (
              <div className="px-5 pt-5">
                <Link href="/login" onClick={close} className="flex min-h-14 items-center justify-center rounded-full bg-rig-700 px-5 text-base font-extrabold text-white hover:bg-rig-900">
                  Sign in or create account
                </Link>
              </div>
            )}

            <nav className="mt-4 divide-y divide-slate-100 border-y border-slate-100" aria-label="Account menu">
              <MenuLink href="/sell" label="Sell a car" icon="plus" onClick={close} />
              <MenuLink href="/favorites" label="Favorites" icon="heart" onClick={close} />
              <MenuLink href={signedIn ? "/messages" : "/login"} label="Messages" icon="chat" onClick={close} />
              <MenuLink href={signedIn ? "/account" : "/login"} label="Account" icon="user" onClick={close} />
            </nav>

            <div className="mt-auto px-5 py-6">
              <Link href="/" onClick={close} className="block py-2 text-sm font-semibold text-slate-600">Back to car search</Link>
              {signedIn && <div className="mt-2 text-sm font-semibold text-slate-600"><SignOutButton /></div>}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function MenuLink({ href, label, icon, onClick }: { href: string; label: string; icon: "plus" | "heart" | "chat" | "user"; onClick: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="flex min-h-[68px] items-center gap-4 px-5 text-lg font-bold text-slate-900 transition hover:bg-slate-50">
      <span className="flex h-9 w-9 items-center justify-center text-slate-900" aria-hidden="true">
        {icon === "plus" && <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>}
        {icon === "heart" && <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.8 4.9c-2-2-5.2-2-7.2 0L12 6.5l-1.6-1.6a5.1 5.1 0 0 0-7.2 7.2L12 21l8.8-8.9a5.1 5.1 0 0 0 0-7.2Z" /></svg>}
        {icon === "chat" && <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 5.5h16v11H9l-5 3v-14Z" /><path d="M8 10h8M8 13h5" /></svg>}
        {icon === "user" && <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-4 3.1-6 7-6s6.2 2 7 6" /></svg>}
      </span>
      <span>{label}</span>
      <svg viewBox="0 0 24 24" className="ml-auto h-5 w-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
    </Link>
  );
}
