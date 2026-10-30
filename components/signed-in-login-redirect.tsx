"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { saveFavoriteAfterLogin } from "@/lib/save-favorite";

/**
 * Already signed in on /login?next=/listings/<id>&fav=<id>: save that car (client-side POST, same
 * as after a password sign-in), then replace /login with the listing.
 */
export function SignedInLoginRedirect({ next, favoriteId }: { next: string; favoriteId: string }) {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void saveFavoriteAfterLogin(favoriteId).finally(() => {
      router.replace(next);
      router.refresh();
    });
  }, [favoriteId, next, router]);

  return (
    <div className="mx-auto max-w-sm py-12 text-center">
      <h1 className="text-2xl font-semibold">You’re signed in</h1>
      <p role="status" className="mt-3 text-muted">Saving the car to your favorites…</p>
      <Link href={next} className="mt-6 inline-flex min-h-11 items-center font-semibold text-primary underline">Continue to the listing</Link>
    </div>
  );
}
