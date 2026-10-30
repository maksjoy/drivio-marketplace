"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";

export const EDIT_PANEL_ID = "edit";
const EDIT_PANEL_HINT_ID = "edit-panel-hint";

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
    <details ref={details} id={EDIT_PANEL_ID} open={defaultOpen || undefined} className="group mt-6 scroll-mt-24 rounded-card border border-line bg-surface p-4">
      {/* The whole row toggles. The hint is aria-hidden inside the summary (so the name stays exactly
          "Edit listing") and read as the description via aria-describedby. */}
      <summary ref={summary} aria-describedby={EDIT_PANEL_HINT_ID} className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-col">
          <span className="font-semibold">Edit listing</span>
          <span id={EDIT_PANEL_HINT_ID} aria-hidden="true" className="text-sm text-muted">Change price, photos or details</span>
        </span>
        <svg viewBox="0 0 24 24" className="h-5 w-5 flex-none text-muted transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </summary>
      {children}
    </details>
  );
}
