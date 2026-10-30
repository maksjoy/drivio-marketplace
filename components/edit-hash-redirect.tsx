"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Older Edit links point at /listings/[id]#edit. The hash never reaches the server, so the listing
 * page sends an owner on to the edit page from the client.
 */
export function EditHashRedirect({ listingId, enabled }: { listingId: string; enabled: boolean }) {
  const router = useRouter();
  useEffect(() => {
    const go = () => {
      if (!enabled || window.location.hash !== "#edit") return;
      router.replace(`/listings/${encodeURIComponent(listingId)}/edit`);
    };
    go();
    window.addEventListener("hashchange", go);
    return () => window.removeEventListener("hashchange", go);
  }, [enabled, listingId, router]);
  return null;
}
