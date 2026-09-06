import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { BottomNav } from "@/components/bottom-nav";

export const metadata: Metadata = {
  title: "ROADORA.ca — Used cars in Alberta",
  description:
    "Buy and sell used cars in Alberta, direct from the owner. No dealers, no markups — just people selling their own vehicle.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 z-30 border-b border-prairie-200 bg-prairie-50/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-2xl font-black tracking-tight text-slate-900">
              ROADORA<span className="text-red-500">.ca</span>
            </Link>
            <nav className="hidden items-center gap-5 text-sm md:flex">
              <Link href="/" className="hover:text-rig-700">Browse</Link>
              <Link href="/favorites" className="hover:text-rig-700">Favorites</Link>
              <Link href="/sell" className="hover:text-rig-700">Sell your car</Link>
              <Link href="/account" className="hover:text-rig-700">Account</Link>
              <Link href="/login" className="rounded-full bg-rig-700 px-4 py-1.5 text-prairie-50 hover:bg-rig-900">
                Sign in
              </Link>
            </nav>
            <Link href="/login" className="rounded-full bg-rig-700 px-4 py-1.5 text-sm text-prairie-50 md:hidden">
              Sign in
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 pb-24 md:pb-8">{children}</main>
        <footer className="mt-16 hidden border-t border-prairie-200 py-8 text-center text-sm text-prairie-600 md:block">
          Private-seller only. No dealer listings.
        </footer>
        <BottomNav />
      </body>
    </html>
  );
}
