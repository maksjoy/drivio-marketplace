import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Archivo } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
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
import { MessageStatusProvider } from "@/components/message-status-provider";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/site-url";

// Archivo has a width axis, so headlines can run narrow like highway signage.
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-display", display: "swap" });

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
    <html lang="en" className={`${archivo.variable} max-w-full overflow-x-hidden`}>
      <body className="max-w-full overflow-x-hidden">
        <MessageStatusProvider signedIn={Boolean(user)}>
          <SiteHeader signedIn={Boolean(user)} />
          <main className="mx-auto w-full max-w-6xl min-w-0 overflow-x-hidden px-4 py-8 pb-24 md:pb-8">{children}</main>
          <footer className="mt-10 border-t border-line px-4 py-8 pb-28 text-center text-sm text-muted md:mt-16 md:pb-8">
            <p><span className="font-bold text-wildrose-600">Alberta-Cars</span> · Private sellers only · Alberta, Canada</p>
            <nav className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2" aria-label="Legal navigation">
              <Link href="/privacy" className="inline-flex min-h-11 items-center hover:text-primary">Privacy Policy</Link>
              <Link href="/terms" className="inline-flex min-h-11 items-center hover:text-primary">Terms of Use</Link>
              <Link href="/contact" className="inline-flex min-h-11 items-center hover:text-primary">Contact</Link>
            </nav>
          </footer>
          <BottomNav />
        </MessageStatusProvider>
      </body>
    </html>
  );
}
