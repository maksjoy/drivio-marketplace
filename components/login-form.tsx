"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { favoriteAfterLogin } from "@/lib/login-redirect";
import { saveFavoriteAfterLogin } from "@/lib/save-favorite";
import { CAPTCHA_REQUIRED_MESSAGE } from "@/lib/turnstile";

export function LoginForm({ siteKey, nonce }: { siteKey: string; nonce?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup" | "recover">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [widgetVersion, setWidgetVersion] = useState(0);
  const [error, setError] = useState<string | null>(searchParams.get("error") ? "The sign-in link could not be completed. Please try again." : null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function switchMode(next: "signin" | "signup" | "recover") {
    setMode(next);
    setError(null);
    setMessage(null);
    setCaptchaToken("");
    setWidgetVersion((version) => version + 1);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    const token = captchaToken;
    if (siteKey && !token) {
      setError(CAPTCHA_REQUIRED_MESSAGE);
      setLoading(false);
      return;
    }
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode,
          email,
          password,
          ...(token ? { captchaToken: token } : {}),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error || "Authentication failed. Please try again.");
        return;
      }
      if (mode === "recover") {
        setMessage("If this email has an account, a password reset link will arrive shortly.");
        return;
      }
      if (mode === "signup" && !body.signedIn) {
        setMessage("Account created. Check your email to confirm the account, then sign in.");
        return;
      }
      const nextPath = safeRedirectPath(searchParams.get("next"), window.location.origin);
      // "Add to favorites" as a guest: save that car now that there is a session (idempotent POST).
      const favorite = favoriteAfterLogin(searchParams.get("fav"));
      if (favorite) await saveFavoriteAfterLogin(favorite);
      router.push(nextPath);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setCaptchaToken("");
      setWidgetVersion((version) => version + 1);
      setLoading(false);
    }
  }

  const title = mode === "signup" ? "Create account" : mode === "recover" ? "Reset password" : "Sign in";
  // Text links: 44px tall. The consent links stay in the sentence via padding cancelled by a negative margin.
  const modeLinkClass = "inline-flex min-h-11 items-center text-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
  const legalLinkClass = "inline-block min-h-11 py-3.5 -my-3.5 underline hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-semibold">{title}</h1>
      <Card className="p-5">
        <form method="post" action="/login" onSubmit={submit} className="space-y-4">
          <Field label="Email">
            <input name="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
          </Field>
          {mode !== "recover" && (
            <Field label="Password">
              <input name="password" type="password" required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
            </Field>
          )}
          {siteKey ? (
            <TurnstileWidget siteKey={siteKey} nonce={nonce} resetKey={`${mode}:${widgetVersion}`} onToken={setCaptchaToken} />
          ) : null}
          {error && <p className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{error}</p>}
          {message && <p className="rounded-lg bg-success-soft p-3 text-sm text-success">{message}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Please wait…" : mode === "recover" ? "Send reset link" : title}
          </Button>
        </form>
      </Card>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {mode !== "signin" && <button type="button" onClick={() => switchMode("signin")} className={modeLinkClass}>Sign in</button>}
        {mode !== "signup" && <button type="button" onClick={() => switchMode("signup")} className={modeLinkClass}>Create account</button>}
        {mode !== "recover" && <button type="button" onClick={() => switchMode("recover")} className={modeLinkClass}>Forgot password?</button>}
      </div>
      <p className="mt-3 text-xs text-muted">
        By creating an account you agree to the <Link href="/terms" className={legalLinkClass}>Terms of Use</Link> and <Link href="/privacy" className={legalLinkClass}>Privacy Policy</Link>.
      </p>
    </div>
  );
}
