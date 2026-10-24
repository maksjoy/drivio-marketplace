"use client";

import Link from "next/link";
import { useMessageStatus } from "@/components/message-status-provider";

export function MessagesNavLink({ active = false }: { active?: boolean }) {
  const { totalUnread } = useMessageStatus();
  return (
    <Link
      href="/messages"
      aria-current={active ? "page" : undefined}
      className={`relative inline-flex min-h-11 items-center rounded-xl px-3.5 text-[15px] font-medium ${active ? "bg-primary-soft text-primary-strong" : "text-ink-soft hover:bg-surface-sunken"}`}
    >
      Messages
      {totalUnread > 0 && (
        <span className="absolute -right-1 top-1 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[10px] font-extrabold leading-none text-white">
          {totalUnread > 99 ? "99+" : totalUnread}
        </span>
      )}
    </Link>
  );
}
