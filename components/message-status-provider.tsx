"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";

type LatestNotification = {
  key: string;
  title: string;
  body: string;
  href: string;
  at: string;
};

type MessageStatus = {
  totalUnread: number;
  personalUnread: number;
  systemUnread: number;
  permission: NotificationPermission | "unsupported";
  refresh: () => Promise<void>;
  requestBrowserNotifications: () => Promise<void>;
};

const MessageStatusContext = createContext<MessageStatus>({
  totalUnread: 0,
  personalUnread: 0,
  systemUnread: 0,
  permission: "unsupported",
  refresh: async () => undefined,
  requestBrowserNotifications: async () => undefined,
});

export function MessageStatusProvider({ signedIn, children }: { signedIn: boolean; children: React.ReactNode }) {
  const [totalUnread, setTotalUnread] = useState(0);
  const [personalUnread, setPersonalUnread] = useState(0);
  const [systemUnread, setSystemUnread] = useState(0);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [toast, setToast] = useState<LatestNotification | null>(null);
  const initialized = useRef(false);
  const lastNotificationKey = useRef<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!signedIn) {
      setTotalUnread(0);
      setPersonalUnread(0);
      setSystemUnread(0);
      return;
    }

    try {
      const response = await fetch("/api/messages/unread", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json().catch(() => ({}));
      const nextTotal = Number(payload.totalUnread || 0);
      setTotalUnread(nextTotal);
      setPersonalUnread(Number(payload.personalUnread || 0));
      setSystemUnread(Number(payload.systemUnread || 0));

      const latest = payload.latest as LatestNotification | null;
      if (!initialized.current) {
        initialized.current = true;
        lastNotificationKey.current = latest?.key || null;
        return;
      }

      if (latest?.key && latest.key !== lastNotificationKey.current && nextTotal > 0) {
        lastNotificationKey.current = latest.key;
        setToast(latest);
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(null), 7000);

        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          const notification = new Notification(latest.title || "New P2PCars message", {
            body: latest.body || "You have a new message.",
            tag: latest.key,
          });
          notification.onclick = () => {
            window.focus();
            window.location.assign(latest.href || "/messages");
            notification.close();
          };
        }
      }
    } catch {
      // Messaging status should never break the marketplace UI.
    }
  }, [signedIn]);

  const requestBrowserNotifications = useCallback(async () => {
    if (typeof Notification === "undefined") {
      setPermission("unsupported");
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
  }, []);

  useEffect(() => {
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
    if (!signedIn) return;

    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    const onRead = () => void refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("p2p:messages-read", onRead);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("p2p:messages-read", onRead);
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, [refresh, signedIn]);

  return (
    <MessageStatusContext.Provider value={{ totalUnread, personalUnread, systemUnread, permission, refresh, requestBrowserNotifications }}>
      {children}
      {toast && (
        <div className="fixed inset-x-4 bottom-24 z-[60] mx-auto max-w-sm rounded-2xl border border-emerald-200 bg-white p-4 shadow-2xl md:bottom-6 md:right-6 md:left-auto md:mx-0 md:w-96">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-extrabold text-slate-950">{toast.title}</p>
              <p className="mt-1 line-clamp-2 text-sm text-slate-600">{toast.body}</p>
            </div>
            <button type="button" onClick={() => setToast(null)} className="flex-none text-lg text-slate-400" aria-label="Dismiss notification">×</button>
          </div>
          <Link href={toast.href} onClick={() => setToast(null)} className="mt-3 inline-block text-sm font-bold text-emerald-700">Open message →</Link>
        </div>
      )}
    </MessageStatusContext.Provider>
  );
}

export function useMessageStatus() {
  return useContext(MessageStatusContext);
}
