"use client";

import { useMessageStatus } from "@/components/message-status-provider";

export function EnableMessageNotifications() {
  const { permission, requestBrowserNotifications } = useMessageStatus();

  if (permission === "granted") {
    return <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">Notifications on</span>;
  }
  if (permission === "denied") {
    return <span className="text-xs text-slate-500">Browser notifications are blocked in your device settings.</span>;
  }
  if (permission === "unsupported") return null;

  return (
    <button
      type="button"
      onClick={() => void requestBrowserNotifications()}
      className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800"
    >
      Enable notifications
    </button>
  );
}
