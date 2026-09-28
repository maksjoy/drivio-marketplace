"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type SocialProviders = {
  google: boolean;
  apple: boolean;
};

function initialError(code: string | null) {
  if (!code) return null;
  if (code === "oauth_google") return "Google sign-in is temporarily unavailable. Please use email instead.";
  if (code === "oauth_apple") return "Apple sign-in is temporarily unavailable. Please use email instead.";
  if (code === "provider") return "That sign-in method is not available.";
  return "The sign-in link could not be completed. Please try again.";
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup" | "recover">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError(searchParams.get("error")));
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<SocialProviders>({ google: false, apple: false });

  const nextPath = useMemo(() => {
    const requested = searchParams.get("next");
    return requested && requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/providers", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((body) => {
        if (!cancelled && body) {
          setProviders({ google: body.google === true, apple: body.apple === true });
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

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
      router.push(nextPath);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const title = mode === "signup" ? "Create account" : mode === "recover" ? "Reset password" : "Sign in";
  const socialAvailable = mode !== "recover" && (providers.google || providers.apple);

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-2 text-2xl font-extrabold text-slate-950">{title}</h1>
      <p className="mb-6 text-sm text-slate-500">
        {mode === "signup" ? "Create your Alberta-Cars account in seconds." : mode === "recover" ? "We’ll email you a secure reset link." : "Access favorites, messages and your listings."}
      </p>

      {socialAvailable && (
        <div className="mb-6 space-y-3">
          {providers.google && <SocialLink provider="google" label="Continue with Google" nextPath={nextPath} />}
          {providers.apple && <SocialLink provider="apple" label="Continue with Apple" nextPath={nextPath} />}
          <div className="flex items-center gap-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            <span>or use email</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium">
          Email
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input mt-1 min-h-12" />
        </label>
        {mode !== "recover" && (
          <label className="block text-sm font-medium">
            Password
            <input type="password" required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="input mt-1 min-h-12" />
          </label>
        )}
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {message && <p className="rounded-xl bg-green-50 p-3 text-sm text-green-700">{message}</p>}
        <button type="submit" disabled={loading} className="min-h-12 w-full rounded-full bg-rig-700 px-5 py-2 font-bold text-white hover:bg-rig-900 disabled:opacity-50">
          {loading ? "Please wait…" : mode === "recover" ? "Send reset link" : title}
        </button>
      </form>

      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {mode !== "signin" && <button onClick={() => { setMode("signin"); setError(null); setMessage(null); }} className="font-semibold text-rig-700 underline">Sign in</button>}
        {mode !== "signup" && <button onClick={() => { setMode("signup"); setError(null); setMessage(null); }} className="font-semibold text-rig-700 underline">Create account</button>}
        {mode !== "recover" && <button onClick={() => { setMode("recover"); setError(null); setMessage(null); }} className="font-semibold text-rig-700 underline">Forgot password?</button>}
      </div>
      <p className="mt-6 text-xs text-prairie-500">
        By creating an account you agree to the Terms of Use and Privacy Policy.
      </p>
    </div>
  );
}

function SocialLink({ provider, label, nextPath }: { provider: "google" | "apple"; label: string; nextPath: string }) {
  const href = `/auth/oauth?provider=${provider}&next=${encodeURIComponent(nextPath)}`;
  return (
    <a href={href} className="flex min-h-[52px] w-full items-center justify-center gap-3 rounded-full border-2 border-slate-200 bg-white px-5 text-base font-bold text-slate-900 transition hover:border-slate-300 hover:bg-slate-50">
      <span className="flex h-6 w-6 items-center justify-center" aria-hidden="true">
        {provider === "google" ? (
          <span className="text-lg font-black">G</span>
        ) : (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor"><path d="M16.7 12.8c0-2.7 2.2-4 2.3-4.1-1.3-1.9-3.3-2.1-4-2.1-1.7-.2-3.3 1-4.2 1-.9 0-2.3-1-3.8-1-1.9 0-3.7 1.1-4.7 2.8-2 3.5-.5 8.7 1.4 11.5.9 1.4 2 2.9 3.5 2.8 1.4-.1 1.9-.9 3.6-.9 1.7 0 2.2.9 3.6.9 1.5 0 2.5-1.4 3.4-2.7 1.1-1.6 1.5-3.1 1.5-3.2-.1 0-2.6-1-2.6-4Zm-2.8-8c.8-1 1.3-2.3 1.2-3.6-1.2.1-2.6.8-3.4 1.8-.7.8-1.4 2.2-1.2 3.5 1.3.1 2.6-.7 3.4-1.7Z" /></svg>
        )}
      </span>
      <span>{label}</span>
    </a>
  );
}
