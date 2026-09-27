"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MessageSellerButton({ listingId, signedIn, mobile = false }: { listingId: string; signedIn: boolean; mobile?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startConversation() {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(`/listings/${listingId}`)}`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.conversationId) throw new Error(body.error || "Could not open messages.");
      router.push(`/messages/${body.conversationId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open messages.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={mobile ? "flex-1" : "w-full"}>
      <button
        type="button"
        onClick={startConversation}
        disabled={loading}
        className={`${mobile ? "min-h-14 w-full" : "w-full py-3.5"} rounded-full bg-emerald-600 px-6 text-base font-extrabold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60`}
      >
        {loading ? "Opening chat…" : signedIn ? "Message seller" : "Sign in to message seller"}
      </button>
      {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}
