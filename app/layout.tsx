import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/inter/latin-800.css";
import "@fontsource/inter/latin-900.css";
import "@fontsource/inter/latin-ext-400.css";
import "@fontsource/inter/latin-ext-500.css";
import "@fontsource/inter/latin-ext-600.css";
import "@fontsource/inter/latin-ext-700.css";
import "@fontsource/inter/latin-ext-800.css";
import "@fontsource/inter/latin-ext-900.css";
import "./globals.css";
import { BottomNav } from "@/components/bottom-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { MessageStatusProvider } from "@/components/message-status-provider";
import { MessagesNavLink } from "@/components/messages-nav-link";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/site-url";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#245886",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Alberta-Cars — Private used cars in Alberta",
  description: "Buy and sell used cars in Alberta directly between private owners. No dealership inventory.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Alberta-Cars — Private car marketplace",
    description: "Private used cars for sale in Alberta.",
    type: "website",
    url: `${SITE_URL}/`,
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <html lang="en" className="max-w-full overflow-x-hidden">
      <body className="max-w-full overflow-x-hidden">
        <MessageStatusProvider signedIn={Boolean(user)}>
          <header className="sticky top-0 z-30 w-full max-w-full border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="h-1 w-full bg-gradient-to-r from-rig-700 via-rig-700 to-wildrose-600" />
            <div className="mx-auto flex w-full max-w-6xl min-w-0 items-center justify-between px-4 py-3.5">
              <Link href="/" className="flex min-w-0 shrink items-center rounded-md transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rig-700" aria-label="Alberta-Cars home">
                {/* Brand lockup: rose-in-a-wheel mark + outlined "Alberta-Cars" wordmark (see public/brand/). */}
                <img src="/brand/lockup.svg" alt="" width={303} height={64} className="block h-[33px] w-auto max-w-full sm:h-[38px]" />
              </Link>
              <nav className="hidden items-center gap-5 text-sm md:flex" aria-label="Primary navigation">
                <Link href="/" className="hover:text-rig-700">Browse</Link>
                <Link href="/favorites" className="hover:text-rig-700">Favorites</Link>
                <Link href="/sell" className="font-semibold text-wildrose-600 hover:text-wildrose-700">Sell your car</Link>
                {user && <MessagesNavLink />}
                <Link href="/account" className="hover:text-rig-700">Account</Link>
                {user ? <SignOutButton /> : <Link href="/login" className="rounded-full bg-rig-700 px-4 py-1.5 text-white hover:bg-rig-900">Sign in</Link>}
              </nav>
              <Link href={user ? "/account" : "/login"} className="rounded-full bg-rig-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-rig-900 md:hidden">
                {user ? "Account" : "Sign in"}
              </Link>
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl min-w-0 overflow-x-hidden px-4 py-8 pb-24 md:pb-8">{children}</main>
          <footer className="mt-10 border-t border-slate-200 px-4 py-8 pb-28 text-center text-sm text-slate-600 md:mt-16 md:pb-8">
            <p><span className="font-bold text-wildrose-600">Alberta-Cars</span> · Private sellers only · Alberta, Canada</p>
            <nav className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2" aria-label="Legal navigation">
              <Link href="/privacy" className="inline-flex min-h-11 items-center hover:text-rig-700">Privacy Policy</Link>
              <Link href="/terms" className="inline-flex min-h-11 items-center hover:text-rig-700">Terms of Use</Link>
              <Link href="/contact" className="inline-flex min-h-11 items-center hover:text-rig-700">Contact</Link>
            </nav>
          </footer>
          <BottomNav />
        </MessageStatusProvider>
      </body>
    </html>
  );
}
