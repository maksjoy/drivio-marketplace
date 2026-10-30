import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { LoginForm } from "@/components/login-form";
import { redirect } from "next/navigation";
import { turnstileSiteKey } from "@/lib/turnstile";
import { createClient } from "@/lib/supabase/server";
import { signedInLoginView } from "@/lib/login-redirect";
import { SignedInLoginRedirect } from "@/components/signed-in-login-redirect";

// Same "Page — Alberta-Cars" pattern as /contact and listing pages.
export const metadata: Metadata = { title: "Sign in — Alberta-Cars" };

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Already signed in: skip the form. Only a safe same-origin `next` is honoured, else /account.
  // A `fav` for that same listing is not written here (no writes during GET): the client
  // component POSTs /api/favorites, exactly like the post-sign-in path, then replaces the URL.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    // Only a first-party navigation may trigger the favorite hand-off (Sec-Fetch-Site, set by the browser).
    const view = signedInLoginView(await searchParams, (await headers()).get("sec-fetch-site"));
    if (view.kind === "redirect") redirect(view.to);
    return <SignedInLoginRedirect next={view.next} favoriteId={view.favoriteId} />;
  }

  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <Suspense fallback={<div className="mx-auto max-w-sm"><h1 className="mb-6 text-2xl font-semibold">Sign in</h1></div>}>
      <LoginForm siteKey={turnstileSiteKey()} nonce={nonce} />
    </Suspense>
  );
}
