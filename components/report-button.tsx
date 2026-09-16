"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReportButton({ listingId, signedIn }: { listingId: string; signedIn: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("Report listing");

  async function report() {
    if (!signedIn) return router.push("/login");
    const reason = window.prompt("Reason for report (scam, dealer, incorrect info, sold, other):")?.trim();
    if (!reason) return;
    setBusy(true);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, reason }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        window.alert(body.error || "Could not submit report.");
        return;
      }
      setLabel("Reported");
    } catch {
      window.alert("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <button type="button" onClick={report} disabled={busy || label === "Reported"} className="rounded-full border border-prairie-300 bg-white px-4 py-2 text-sm font-medium disabled:opacity-50">{label}</button>;
}
