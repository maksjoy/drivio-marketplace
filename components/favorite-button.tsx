"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

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

    setBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setBusy(false);
      router.push("/login");
      return;
    }

    const previous = favorite;
    setFavorite(!favorite);

    const result = favorite
      ? await supabase.from("favorites").delete().eq("user_id", user.id).eq("listing_id", listingId)
      : await supabase.from("favorites").insert({ user_id: user.id, listing_id: listingId });

    if (result.error) {
      console.error("Unable to update favorite", result.error);
      setFavorite(previous);
    } else {
      router.refresh();
    }
    setBusy(false);
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
