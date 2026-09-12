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
      className="hover:text-rig-700"
    >
      Sign out
    </button>
  );
}
