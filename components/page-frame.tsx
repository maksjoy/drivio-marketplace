"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const EDIT_PATH = /^\/listings\/[^/]+\/edit$/;

/** The edit page brings its own spacing so the sticky save bar is not stacked on the site frame. */
export function PageFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const edit = EDIT_PATH.test(pathname) || pathname === "/e2e-harness/edit";
  if (edit) {
    return (
      <main className="mx-auto w-full min-w-0 overflow-x-hidden px-4 pb-32 pt-3 md:px-6 md:pb-12 md:pt-6 lg:max-w-[1068px]">
        {children}
      </main>
    );
  }
  return (
    <main className="mx-auto w-full max-w-6xl min-w-0 overflow-x-hidden px-4 py-8 pb-24 md:pb-8">{children}</main>
  );
}
