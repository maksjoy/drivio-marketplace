"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Payload = Record<string, unknown> & { action: string };

export function AdminActionButton({ payload, children, danger = false, confirmText }: { payload: Payload; children: React.ReactNode; danger?: boolean; confirmText?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run() {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) window.alert(body.error || "Admin action failed.");
      else router.refresh();
    } catch {
      window.alert("Network error.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button type="button" disabled={busy} onClick={run} className={`rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${danger ? "border-red-300 text-red-700" : "border-prairie-300 text-prairie-800"}`}>
      {busy ? "Working…" : children}
    </button>
  );
}
