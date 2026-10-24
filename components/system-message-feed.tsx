"use client";

import { useEffect } from "react";

type SystemMessage = {
  id: string;
  title: string;
  body: string;
  category: string;
  created_at: string;
};

export function SystemMessageFeed({ messages }: { messages: SystemMessage[] }) {
  useEffect(() => {
    let cancelled = false;
    async function markRead() {
      await fetch("/api/messages/system/read", { method: "POST" }).catch(() => undefined);
      if (!cancelled) window.dispatchEvent(new Event("p2p:messages-read"));
    }
    void markRead();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-4">
      {messages.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line-strong bg-white p-8 text-center text-sm text-muted">
          No Alberta Cars announcements yet.
        </div>
      )}
      {messages.map((message) => (
        <article key={message.id} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-ink px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white">Alberta Cars</span>
              <span className="rounded-full bg-surface-sunken px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted">{message.category}</span>
            </div>
            <time className="text-xs text-muted">{formatDate(message.created_at)}</time>
          </div>
          <h2 className="mt-3 text-lg font-extrabold text-ink">{message.title}</h2>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-ink-soft">{message.body}</p>
        </article>
      ))}
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}
