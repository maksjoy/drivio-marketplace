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
        <div className="rounded-2xl border border-dashed border-prairie-300 bg-white p-8 text-center text-sm text-slate-500">
          No P2PCars announcements yet.
        </div>
      )}
      {messages.map((message) => (
        <article key={message.id} className="rounded-2xl border border-prairie-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white">P2PCars</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">{message.category}</span>
            </div>
            <time className="text-xs text-slate-400">{formatDate(message.created_at)}</time>
          </div>
          <h2 className="mt-3 text-lg font-extrabold text-slate-950">{message.title}</h2>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{message.body}</p>
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
