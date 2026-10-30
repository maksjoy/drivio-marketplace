"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessagesNavLink } from "@/components/messages-nav-link";
import { SignOutButton } from "@/components/sign-out-button";
import { ButtonLink } from "@/components/ui/button";

const linkIdle = "inline-flex min-h-11 items-center rounded-xl px-3.5 text-[15px] font-medium text-ink-soft hover:bg-surface-sunken";
const linkActive = "inline-flex min-h-11 items-center rounded-xl bg-primary-soft px-3.5 text-[15px] font-medium text-primary-strong";

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const browseActive = pathname === "/" || pathname.startsWith("/listings/");
  const savedActive = pathname.startsWith("/favorites");
  const messagesActive = pathname.startsWith("/messages");
  const accountActive = pathname.startsWith("/account");

  return (
    <header className="sticky top-0 z-30 w-full max-w-full border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl min-w-0 items-center gap-3 px-4 md:h-[72px] md:gap-8 md:px-6">
        <Link
          href="/"
          aria-label="Alberta-Cars home"
          className="flex min-w-0 shrink items-center rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          <img src="/brand/lockup.svg" alt="" width={303} height={64} className="block h-8 w-auto max-w-full md:h-9" />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
          <Link href="/" aria-current={browseActive ? "page" : undefined} className={browseActive ? linkActive : linkIdle}>Browse</Link>
          <Link href="/favorites" aria-current={savedActive ? "page" : undefined} className={savedActive ? linkActive : linkIdle}>Saved</Link>
          <MessagesNavLink active={messagesActive} />
        </nav>

        <div className="ml-auto hidden items-center gap-3 md:flex">
          <ButtonLink href="/sell" variant="accent" size="sm" className="px-4 text-[15px]">
            <PlusIcon />
            Sell your car
          </ButtonLink>
          {signedIn ? (
            <>
              <Link href="/account" aria-current={accountActive ? "page" : undefined} className={accountActive ? linkActive : linkIdle}>Account</Link>
              <SignOutButton />
            </>
          ) : (
            <ButtonLink href="/login" variant="secondary" size="sm" className="border-line-strong px-4 text-[15px] !text-primary">
              Sign in
            </ButtonLink>
          )}
        </div>

        <ButtonLink
          href={signedIn ? "/account" : "/login"}
          variant="secondary"
          size="sm"
          className="ml-auto border-line-strong px-4 !text-primary md:hidden"
        >
          {signedIn ? "Account" : "Sign in"}
        </ButtonLink>
      </div>
    </header>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
