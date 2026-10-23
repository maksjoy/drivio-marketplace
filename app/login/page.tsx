"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { safeRedirectPath } from "@/lib/safe-redirect";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup" | "recover">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(searchParams.get("error") ? "The sign-in link could not be completed. Please try again." : null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: mode, email, password }),
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
      router.push(nextPath);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const title = mode === "signup" ? "Create account" : mode === "recover" ? "Reset password" : "Sign in";

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-semibold">{title}</h1>
      <Card className="p-5">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email">
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
          </Field>
          {mode !== "recover" && (
            <Field label="Password">
              <input type="password" required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
            </Field>
          )}
          {error && <p className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{error}</p>}
          {message && <p className="rounded-lg bg-success-soft p-3 text-sm text-success">{message}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Please wait…" : mode === "recover" ? "Send reset link" : title}
          </Button>
        </form>
      </Card>
      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {mode !== "signin" && <button onClick={() => { setMode("signin"); setError(null); setMessage(null); }} className="text-primary underline">Sign in</button>}
        {mode !== "signup" && <button onClick={() => { setMode("signup"); setError(null); setMessage(null); }} className="text-primary underline">Create account</button>}
        {mode !== "recover" && <button onClick={() => { setMode("recover"); setError(null); setMessage(null); }} className="text-primary underline">Forgot password?</button>}
      </div>
      <p className="mt-6 text-xs text-muted">
        By creating an account you agree to the <Link href="/terms" className="underline hover:text-primary">Terms of Use</Link> and <Link href="/privacy" className="underline hover:text-primary">Privacy Policy</Link>.
      </p>
    </div>
  );
}
