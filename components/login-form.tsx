"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TurnstileWidget } from "@/components/turnstile-widget";
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
      const requested = searchParams.get("next");
      const nextPath = requested && requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";
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

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-semibold">{title}</h1>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium">
          Email
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input mt-1" />
        </label>
        {mode !== "recover" && (
          <label className="block text-sm font-medium">
            Password
            <input type="password" required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="input mt-1" />
          </label>
        )}
        {siteKey ? (
          <TurnstileWidget siteKey={siteKey} nonce={nonce} resetKey={`${mode}:${widgetVersion}`} onToken={setCaptchaToken} />
        ) : null}
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {message && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}
        <button type="submit" disabled={loading} className="w-full rounded-full bg-rig-700 py-2 text-prairie-50 hover:bg-rig-900 disabled:opacity-50">
          {loading ? "Please wait…" : mode === "recover" ? "Send reset link" : title}
        </button>
      </form>
      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {mode !== "signin" && <button onClick={() => switchMode("signin")} className="text-rig-700 underline">Sign in</button>}
        {mode !== "signup" && <button onClick={() => switchMode("signup")} className="text-rig-700 underline">Create account</button>}
        {mode !== "recover" && <button onClick={() => switchMode("recover")} className="text-rig-700 underline">Forgot password?</button>}
      </div>
      <p className="mt-6 text-xs text-prairie-500">
        By creating an account you agree to the <Link href="/terms" className="underline hover:text-rig-700">Terms of Use</Link> and <Link href="/privacy" className="underline hover:text-rig-700">Privacy Policy</Link>.
      </p>
    </div>
  );
}
