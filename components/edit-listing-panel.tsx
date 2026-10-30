"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";

export const EDIT_PANEL_ID = "edit";

/**
 * The owner's collapsed "Edit listing" panel. Arriving with #edit (from the Edit link on /account or
 * the owner link on the listing page) opens it and moves focus to its summary. The open state is
 * set on the client from location.hash, so the page needs no inline script or style.
 */
export function EditListingPanel({ children, defaultOpen = false }: { children: ReactNode; defaultOpen?: boolean }) {
  const details = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);

  const reveal = useCallback(() => {
    if (window.location.hash !== `#${EDIT_PANEL_ID}` || !details.current) return;
    details.current.open = true;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    summary.current?.focus({ preventScroll: true });
    details.current.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
  }, []);

  useEffect(() => {
    // Wait a frame so a client-side navigation has written the new URL (and laid out the page).
    const frame = window.requestAnimationFrame(reveal);
    // A same-page #edit link: hashchange covers the first click; the click handler covers a
    // repeat click when the hash is already #edit (no hashchange fires then).
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.(`a[href="#${EDIT_PANEL_ID}"]`);
      if (link) window.requestAnimationFrame(reveal);
    };
    window.addEventListener("hashchange", reveal);
    document.addEventListener("click", onClick);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", reveal);
      document.removeEventListener("click", onClick);
    };
  }, [reveal]);

  return (
    <details ref={details} id={EDIT_PANEL_ID} open={defaultOpen || undefined} className="mt-6 scroll-mt-24 rounded-card border border-line bg-surface p-4">
      <summary ref={summary} className="flex min-h-11 cursor-pointer items-center rounded-lg font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Edit listing</summary>
      {children}
    </details>
  );
}
