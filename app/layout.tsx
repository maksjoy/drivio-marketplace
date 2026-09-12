import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { BottomNav } from "@/components/bottom-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/site-url";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "P2PCars.ca — Private used cars in Alberta",
  description: "Buy and sell used cars in Alberta directly between private owners. No dealership inventory.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "P2PCars.ca — People to People car marketplace",
    description: "Private used cars for sale in Alberta.",
    type: "website",
    url: `${SITE_URL}/`,
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 z-30 border-b border-prairie-200 bg-prairie-50/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-2xl font-black tracking-tight text-slate-900">
              P2PCars<span className="text-red-500">.ca</span>
            </Link>
            <nav className="hidden items-center gap-5 text-sm md:flex" aria-label="Primary navigation">
              <Link href="/" className="hover:text-rig-700">Browse</Link>
              <Link href="/favorites" className="hover:text-rig-700">Favorites</Link>
              <Link href="/sell" className="hover:text-rig-700">Sell your car</Link>
              <Link href="/account" className="hover:text-rig-700">Account</Link>
              {user ? <SignOutButton /> : <Link href="/login" className="rounded-full bg-rig-700 px-4 py-1.5 text-prairie-50 hover:bg-rig-900">Sign in</Link>}
            </nav>
            <Link href={user ? "/account" : "/login"} className="rounded-full bg-rig-700 px-4 py-1.5 text-sm text-prairie-50 md:hidden">
              {user ? "Account" : "Sign in"}
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 pb-24 md:pb-8">{children}</main>
        <footer className="mt-16 hidden border-t border-prairie-200 py-8 text-center text-sm text-prairie-600 md:block">
          <p>Private sellers only · Alberta, Canada</p>
          <nav className="mt-3 flex justify-center gap-5" aria-label="Legal navigation">
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms of Use</Link>
            <Link href="/contact">Contact</Link>
          </nav>
        </footer>
        <BottomNav />
      </body>
    </html>
  );
}
