"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminRejectListingButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function reject() {
    const reason = window.prompt("Reason for rejection. This is visible to the seller:", "Listing does not meet marketplace requirements.");
    if (reason === null) return;
    if (!reason.trim()) {
      window.alert("Add a rejection reason.");
      return;
    }
    if (!window.confirm("Reject this listing?")) return;

    setBusy(true);
    try {
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "listing_status", id: listingId, status: "rejected", reason: reason.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not reject listing.");
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not reject listing.");
    } finally {
      setBusy(false);
    }
  }

  return <button type="button" disabled={busy} onClick={reject} className="rounded-full border border-red-300 px-4 py-2 text-xs font-black text-red-700 disabled:opacity-50">{busy ? "Working…" : "Reject"}</button>;
}
