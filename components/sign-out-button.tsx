"use client";

import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "signout" }),
        });
        router.push("/");
        router.refresh();
      }}
      className="inline-flex min-h-11 items-center rounded-xl px-3.5 text-[15px] font-medium text-ink-soft hover:bg-surface-sunken hover:text-primary"
    >
      Sign out
    </button>
  );
}
