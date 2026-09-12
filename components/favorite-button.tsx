"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function FavoriteButton({
  listingId,
  initialFavorite,
  signedIn,
  compact = false,
}: {
  listingId: string;
  initialFavorite: boolean;
  signedIn: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [favorite, setFavorite] = useState(initialFavorite);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!signedIn) {
      router.push("/login");
      return;
    }

    const previous = favorite;
    setFavorite(!favorite);
    setBusy(true);
    try {
      const response = await fetch("/api/favorites", {
        method: favorite ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      });
      if (response.status === 401) {
        setFavorite(previous);
        router.push("/login");
        return;
      }
      if (!response.ok) setFavorite(previous);
      else router.refresh();
    } catch {
      setFavorite(previous);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={favorite}
      className={
        compact
          ? "inline-flex h-10 w-10 items-center justify-center rounded-full border border-prairie-200 bg-white/95 text-xl shadow-sm disabled:opacity-50"
          : "inline-flex items-center gap-2 rounded-full border border-prairie-300 bg-white px-4 py-2 text-sm font-medium disabled:opacity-50"
      }
    >
      <span aria-hidden="true">{favorite ? "♥" : "♡"}</span>
      {!compact && (favorite ? "Saved" : "Save")}
    </button>
  );
}
