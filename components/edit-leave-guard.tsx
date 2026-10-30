"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { buttonClasses } from "@/components/ui/button";

type LeaveGuard = {
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
  /** When dirty, confirm before leaving. When clean, navigate immediately. */
  ask: (href: string, trigger: HTMLElement) => void;
};

const LeaveContext = createContext<LeaveGuard | null>(null);

/** Cmd/Ctrl/Shift/Alt/middle click should open a tab or window. The dialog is for a plain left click. */
export function isModifiedClick(event: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; button: number }) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

export function useEditLeave(): LeaveGuard {
  return useContext(LeaveContext) ?? {
    dirty: false,
    setDirty: () => {},
    ask: (href) => {
      if (process.env.NODE_ENV !== "production") {
        throw new Error("useEditLeave() was called outside EditLeaveGuard.");
      }
      window.location.assign(href);
    },
  };
}

/**
 * Confirms leaving an edit that has unsaved changes.
 * Cancel, Back to listing, and other same-origin links open this dialog.
 * Reload and tab close use beforeunload.
 * The browser Back button is not intercepted: the App Router applies the previous entry
 * before a dialog can cancel it, and pushing a guard state back fights that history.
 */
export function EditLeaveGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [dirty, setDirty] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const hrefRef = useRef("/");

  const ask = useCallback((href: string, trigger: HTMLElement) => {
    hrefRef.current = href;
    openerRef.current = trigger;
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const onClick = (event: globalThis.MouseEvent) => {
      if (event.defaultPrevented || isModifiedClick(event) || dialogRef.current?.open) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.hasAttribute("data-leave-guarded")) return;
      const frame = anchor.getAttribute("target");
      if ((frame && frame !== "_self") || anchor.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(anchor.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault();
      ask(`${url.pathname}${url.search}${url.hash}`, anchor);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dirty, ask]);

  const guard = useMemo<LeaveGuard>(() => ({ dirty, setDirty, ask }), [dirty, ask]);

  function restoreFocus() {
    const opener = openerRef.current;
    window.requestAnimationFrame(() => opener?.focus());
  }

  function keepEditing() {
    dialogRef.current?.close();
  }

  function discard() {
    const href = hrefRef.current;
    setDirty(false);
    dialogRef.current?.close();
    router.push(href);
  }

  function onDialogClick(event: ReactMouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) keepEditing();
  }

  return (
    <LeaveContext.Provider value={guard}>
      {children}
      <dialog
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="discard-changes-title"
        aria-describedby="discard-changes-description"
        onClick={onDialogClick}
        onClose={restoreFocus}
        className="m-0 mt-auto w-full max-w-none rounded-t-sheet border border-line bg-surface p-0 text-ink shadow-sheet backdrop:bg-ink/40 md:m-auto md:w-[min(100%,28rem)] md:rounded-card md:shadow-lift"
      >
        <div className="px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:pb-5">
          <h2 id="discard-changes-title" className="text-lg font-semibold text-ink">Discard changes?</h2>
          <p id="discard-changes-description" className="mt-1 text-sm text-muted">Your changes to this listing will be lost.</p>
          <div className="mt-5 flex flex-col gap-2 md:flex-row md:justify-end">
            <button
              type="button"
              onClick={keepEditing}
              className={buttonClasses("primary", "lg", "min-h-12 w-full md:order-2 md:w-auto")}
            >
              Keep editing
            </button>
            <button
              type="button"
              onClick={discard}
              className={buttonClasses("danger", "lg", "min-h-12 w-full md:order-1 md:w-auto")}
            >
              Discard
            </button>
          </div>
        </div>
      </dialog>
    </LeaveContext.Provider>
  );
}

export function EditBackLink({ href, className, children }: { href: string; className: string; children: ReactNode }) {
  const leave = useEditLeave();
  return (
    <Link
      href={href}
      className={className}
      data-leave-guarded=""
      onClick={(event) => {
        if (!leave.dirty || isModifiedClick(event)) return;
        event.preventDefault();
        leave.ask(href, event.currentTarget);
      }}
    >
      {children}
    </Link>
  );
}
