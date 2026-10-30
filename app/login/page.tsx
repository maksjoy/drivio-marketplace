import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { LoginForm } from "@/components/login-form";
import { redirect } from "next/navigation";
import { turnstileSiteKey } from "@/lib/turnstile";
import { createClient } from "@/lib/supabase/server";
import { signedInLoginRedirect } from "@/lib/login-redirect";

// Same "Page — Alberta-Cars" pattern as /contact and listing pages.
export const metadata: Metadata = { title: "Sign in — Alberta-Cars" };

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Already signed in: skip the form. Only a safe same-origin `next` is honoured, else /account.
  // (`fav` is not applied here: favoriting needs the explicit sign-in action, not just a link.)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect(signedInLoginRedirect((await searchParams).next));

  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <Suspense fallback={<div className="mx-auto max-w-sm"><h1 className="mb-6 text-2xl font-semibold">Sign in</h1></div>}>
      <LoginForm siteKey={turnstileSiteKey()} nonce={nonce} />
    </Suspense>
  );
}
