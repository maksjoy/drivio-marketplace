import { Suspense } from "react";
import { headers } from "next/headers";
import { LoginForm } from "@/components/login-form";
import { turnstileSiteKey } from "@/lib/turnstile";

export default async function LoginPage() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <Suspense fallback={<div className="mx-auto max-w-sm"><h1 className="mb-6 text-2xl font-semibold">Sign in</h1></div>}>
      <LoginForm siteKey={turnstileSiteKey()} nonce={nonce} />
    </Suspense>
  );
}
