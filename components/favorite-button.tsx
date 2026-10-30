"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { guestFavoriteLoginHref } from "@/lib/login-redirect";

export function FavoriteButton({
  listingId,
  initialFavorite,
  signedIn,
  compact = false,
}: {
  listingId: string;
  /** `null` while the caller is still loading the favorite status: the heart is neutral and pending. */
  initialFavorite: boolean | null;
  signedIn: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  // `favorite` is the server-confirmed state: it only flips after the request succeeds, so a
  // reload right after a tap can never show a state the database does not have yet.
  const [favorite, setFavorite] = useState(initialFavorite === true);
  const [pending, setPending] = useState(false);
  // Follow the parent's value when it changes (the catalog loads favorites after the cards render).
  const [seenInitial, setSeenInitial] = useState(initialFavorite);
  if (initialFavorite !== seenInitial) {
    setSeenInitial(initialFavorite);
    if (!pending && initialFavorite !== null) setFavorite(initialFavorite);
  }

  // Guests come back to this page after signing in, and the car is saved for them once.
  function goToLogin() {
    router.push(guestFavoriteLoginHref(`${window.location.pathname}${window.location.search}`, listingId));
  }

  const unknown = initialFavorite === null;

  async function toggle() {
    if (pending || unknown) return;
    if (!signedIn) {
      goToLogin();
      return;
    }

    const next = !favorite;
    setPending(true);
    try {
      const response = await fetch("/api/favorites", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
        // Lets the request finish even if the page is reloaded or left while it is in flight.
        keepalive: true,
      });
      if (response.status === 401) {
        goToLogin();
        return;
      }
      if (response.ok) {
        setFavorite(next);
        // Re-render server data (e.g. drop the card on /favorites) only after the write landed.
        router.refresh();
      }
    } catch {
      // Network error: keep the confirmed state.
    } finally {
      setPending(false);
    }
  }

  const busy = pending || unknown;
  // While the status is unknown there is no pressed state to report (aria-pressed is omitted
  // rather than guessed) and the glyph is hidden, so nothing flips once favorites arrive.
  const label = unknown ? "Loading favorite status" : favorite ? "Remove from favorites" : "Add to favorites";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-busy={busy}
      aria-label={label}
      aria-pressed={unknown ? undefined : favorite}
      className={
        compact
          ? "inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white/95 text-xl shadow-sm disabled:opacity-50"
          : "inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-white px-4 py-2 text-sm font-medium disabled:opacity-50"
      }
    >
      <span aria-hidden="true" className={unknown ? "invisible" : undefined}>{favorite ? "♥" : "♡"}</span>
      {!compact && label}
    </button>
  );
}
