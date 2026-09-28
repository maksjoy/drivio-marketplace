import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";
import { BottomNav } from "@/components/bottom-nav";
import { HeaderMenu } from "@/components/header-menu";
import { MessageStatusProvider } from "@/components/message-status-provider";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/site-url";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
            <div className="mx-auto flex h-[68px] w-full max-w-6xl min-w-0 items-center justify-between px-4">
              <Link href="/" className="relative block h-11 w-[138px] shrink-0 sm:h-12 sm:w-[154px]" aria-label="Alberta-Cars home">
                <Image src="/alberta-cars-logo.webp" alt="Alberta-Cars" fill sizes="154px" className="object-contain object-left" priority />
              </Link>
              <div className="hidden items-center gap-5 text-sm font-semibold text-slate-700 md:flex">
                <Link href="/" className="hover:text-rig-700">Browse</Link>
                <Link href="/sell" className="text-wildrose-600 hover:text-wildrose-700">Sell your car</Link>
              </div>
              <HeaderMenu signedIn={Boolean(user)} />
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl min-w-0 overflow-x-hidden px-4 py-4 pb-24 sm:py-6 md:pb-8">{children}</main>
          <footer className="mt-16 hidden border-t border-slate-200 py-8 text-center text-sm text-slate-600 md:block">
            <p><span className="font-bold text-wildrose-600">Alberta-Cars</span> · Private sellers only · Alberta, Canada</p>
            <nav className="mt-3 flex justify-center gap-5" aria-label="Legal navigation">
              <Link href="/privacy" className="hover:text-rig-700">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-rig-700">Terms of Use</Link>
              <Link href="/contact" className="hover:text-rig-700">Contact</Link>
            </nav>
          </footer>
          <BottomNav />
        </MessageStatusProvider>
      </body>
    </html>
  );
}
