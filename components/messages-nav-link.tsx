"use client";

import Link from "next/link";
import { useMessageStatus } from "@/components/message-status-provider";

export function MessagesNavLink() {
  const { totalUnread } = useMessageStatus();
  return (
    <Link href="/messages" className="relative hover:text-rig-700">
      Messages
      {totalUnread > 0 && (
        <span className="absolute -right-3 -top-2 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[10px] font-extrabold leading-none text-white">
          {totalUnread > 99 ? "99+" : totalUnread}
        </span>
      )}
    </Link>
  );
}
