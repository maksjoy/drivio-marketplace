"use client";

import { useMessageStatus } from "@/components/message-status-provider";

export function EnableMessageNotifications() {
  const { permission, requestBrowserNotifications } = useMessageStatus();

  if (permission === "granted") {
    return <span className="rounded-full bg-success-soft px-3 py-1.5 text-xs font-bold text-success">Notifications on</span>;
  }
  if (permission === "denied") {
    return <span className="text-xs text-muted">Browser notifications are blocked in your device settings.</span>;
  }
  if (permission === "unsupported") return null;

  return (
    <button
      type="button"
      onClick={() => void requestBrowserNotifications()}
      className="rounded-full border border-success/40 bg-success-soft px-3 py-1.5 text-xs font-bold text-success-strong"
    >
      Enable notifications
    </button>
  );
}
