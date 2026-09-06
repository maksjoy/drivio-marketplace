"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function MyListingActions({ listingId, status }: { listingId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markSold() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/listings/${listingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "sold" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setError(body.error ?? "Could not update listing.");
      else router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this listing and its photos? This can't be undone.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/listings/${listingId}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setError(body.error ?? "Could not delete listing.");
      else router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-sm">
      <div className="flex gap-2">
        {status === "active" && (
          <button disabled={busy} onClick={markSold} className="rounded-full border border-prairie-300 px-3 py-1 disabled:opacity-50">
            Mark sold
          </button>
        )}
        <button disabled={busy} onClick={remove} className="rounded-full border border-red-300 px-3 py-1 text-red-600 disabled:opacity-50">
          Delete
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
