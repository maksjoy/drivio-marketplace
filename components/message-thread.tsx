"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Message = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

const LINK_PATTERN = /(?:https?:\/\/|www\.|t\.me\/|wa\.me\/|discord\.gg\/|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|ca|net|org|io|co|me|app|xyz|info|biz|dev|ai|ly|gg)(?:[\/?#:\s]|$))/i;

export function MessageThread({ conversationId, currentUserId, initialMessages, isSeller, sellerPhone }: { conversationId: string; currentUserId: string; initialMessages: Message[]; isSeller: boolean; sellerPhone: string | null; }) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadMessages = useCallback(async () => {
    const res = await fetch(`/api/messages/${conversationId}`, { cache: "no-store" });
    if (!res.ok) return;
    const payload = await res.json().catch(() => ({}));
    if (Array.isArray(payload.messages)) setMessages(payload.messages);
    window.dispatchEvent(new Event("p2p:messages-read"));
  }, [conversationId]);

  useEffect(() => {
    window.dispatchEvent(new Event("p2p:messages-read"));
    const timer = window.setInterval(loadMessages, 4000);
    return () => window.clearInterval(timer);
  }, [loadMessages]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [messages.length]);
  const canSharePhone = useMemo(() => Boolean(isSeller && sellerPhone && messages.length >= 2), [isSeller, sellerPhone, messages.length]);

  async function sendMessage(text: string) {
    const clean = text.trim();
    if (!clean || sending) return;
    if (LINK_PATTERN.test(clean)) {
      setError("Links are not allowed in Alberta Cars messages. Keep the conversation inside Alberta Cars for safety.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/messages/${conversationId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: clean }) });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.message) throw new Error(payload.error || "Could not send message.");
      setMessages((current) => [...current, payload.message]);
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  }

  async function submit(event: FormEvent) { event.preventDefault(); await sendMessage(body); }
  async function sharePhone() { if (sellerPhone) await sendMessage(`You can call or text me at ${sellerPhone}`); }

  return (
    <div className="flex min-h-[62vh] w-full min-w-0 max-w-full flex-col overflow-hidden rounded-2xl border border-prairie-200 bg-white shadow-sm">
      <div className="border-b border-prairie-200 bg-slate-50 px-4 py-3">
        <p className="text-sm font-bold text-slate-900">Private Alberta Cars chat</p>
        <p className="mt-0.5 text-xs text-slate-500">Links are blocked. Anti-spam limit: 20 messages/hour and 100 messages/24h per account.</p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && <div className="mx-auto max-w-md rounded-2xl bg-emerald-50 p-4 text-center text-sm text-emerald-900">Start with a question about the vehicle. Real names and phone numbers stay private until someone chooses to share them.</div>}
        {messages.map((message) => {
          const mine = message.sender_id === currentUserId;
          return <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${mine ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-900"}`}><p className="whitespace-pre-wrap break-words">{message.body}</p><p className={`mt-1 text-[10px] ${mine ? "text-emerald-100" : "text-slate-400"}`}>{new Intl.DateTimeFormat("en-CA", { hour: "numeric", minute: "2-digit" }).format(new Date(message.created_at))}</p></div></div>;
        })}
        <div ref={bottomRef} />
      </div>
      <div className="min-w-0 border-t border-prairie-200 p-3">
        {canSharePhone && <button type="button" onClick={sharePhone} disabled={sending} className="mb-2 rounded-full border border-emerald-600 px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">Share my phone number</button>}
        {isSeller && sellerPhone && messages.length < 2 && <p className="mb-2 text-xs text-slate-500">Your phone stays hidden. The share button appears after the conversation starts.</p>}
        <form onSubmit={submit} className="flex w-full min-w-0 gap-2 overflow-hidden">
          <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={1000} rows={2} placeholder="Write a message…" className="input min-h-[52px] min-w-0 w-0 flex-1 resize-none" />
          <button type="submit" disabled={sending || !body.trim()} className="flex-none self-end rounded-full bg-slate-950 px-5 py-3 text-sm font-extrabold text-white disabled:opacity-50">{sending ? "Sending…" : "Send"}</button>
        </form>
        {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
      </div>
    </div>
  );
}
