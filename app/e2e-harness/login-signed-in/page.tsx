import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignedInLoginRedirect } from "@/components/signed-in-login-redirect";
import { requireE2eHarness } from "@/lib/e2e-harness";
import { signedInLoginView } from "@/lib/login-redirect";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Signed-in /login (test harness)", robots: { index: false, follow: false } };

// /login for a user who already has a session, without a real session: same decision and the
// same client component as app/login/page.tsx; e2e mocks POST /api/favorites.
export default async function SignedInLoginHarness({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  requireE2eHarness();
  const view = signedInLoginView(await searchParams, (await headers()).get("sec-fetch-site"));
  if (view.kind === "redirect") redirect(view.to);
  return <SignedInLoginRedirect next={view.next} favoriteId={view.favoriteId} />;
}
