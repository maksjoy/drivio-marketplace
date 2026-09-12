"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return setError("Passwords must match.");
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_password", password }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) return setError(body.error || "Could not update password.");
      router.push("/account");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-semibold">Choose a new password</h1>
      <form onSubmit={submit} className="space-y-4">
        <input className="input" type="password" autoComplete="new-password" minLength={8} required placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <input className="input" type="password" autoComplete="new-password" minLength={8} required placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button disabled={busy} className="w-full rounded-full bg-rig-700 py-2 text-white disabled:opacity-50">{busy ? "Saving…" : "Save password"}</button>
      </form>
    </div>
  );
}
