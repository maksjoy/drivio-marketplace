"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const categories = [
  { value: "info", label: "Information" },
  { value: "news", label: "News" },
  { value: "safety", label: "Safety" },
  { value: "promo", label: "Promotion" },
  { value: "welcome", label: "Welcome" },
] as const;

export function AdminBroadcastForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]["value"]>("info");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!window.confirm("Send this P2PCars message to every signed-in user inbox?")) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "system_broadcast", title, body, category }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not send the broadcast.");
      setTitle("");
      setBody("");
      setCategory("info");
      setMessage("Broadcast published to P2PCars Updates.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the broadcast.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <select value={category} onChange={(event) => setCategory(event.target.value as typeof category)} className="input" aria-label="Broadcast category">
          {categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required placeholder="Message title" className="input" />
      </div>
      <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={3000} required rows={5} placeholder="Write the message users will see in P2PCars Updates…" className="input resize-y" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">Stored once and shown to all users. This does not create thousands of duplicate chat rows.</p>
        <button disabled={busy || !title.trim() || !body.trim()} className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-50">
          {busy ? "Publishing…" : "Send to everyone"}
        </button>
      </div>
      {message && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p>}
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
    </form>
  );
}
