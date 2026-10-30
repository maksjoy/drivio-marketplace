"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClasses } from "@/components/ui/button";

export function MyListingActions({ listingId, status, title }: { listingId: string; status: string; title: string }) {
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
      <div className="flex flex-wrap gap-2">
        {status !== "sold" && (
          <Link href={`/listings/${listingId}/edit`} aria-label={`Edit ${title}`} className="inline-flex min-h-11 items-center rounded-full border border-line-strong bg-surface px-4 text-ink hover:bg-surface-sunken">
            Edit
          </Link>
        )}
        {status === "active" && (
          <button disabled={busy} onClick={markSold} className="inline-flex min-h-11 items-center rounded-full border border-line-strong px-4 disabled:opacity-50">
            Mark sold
          </button>
        )}
        <button disabled={busy} onClick={remove} className={buttonClasses("danger", "sm", "!rounded-full !px-4")}>
          Delete
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
