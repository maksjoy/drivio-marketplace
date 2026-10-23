"use client";

import { useEffect, useRef } from "react";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

function ensureTurnstile(nonce: string | undefined, onReady: () => void) {
  if (window.turnstile) {
    onReady();
    return;
  }

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
  if (existing) {
    if (existing.dataset.loaded === "true") onReady();
    else existing.addEventListener("load", onReady, { once: true });
    return;
  }

  const script = document.createElement("script");
  script.src = SCRIPT_SRC;
  script.async = true;
  script.defer = true;
  if (nonce) {
    script.nonce = nonce;
    script.setAttribute("nonce", nonce);
  }
  script.addEventListener("load", () => {
    script.dataset.loaded = "true";
    onReady();
  }, { once: true });
  document.head.appendChild(script);
}

export function TurnstileWidget({
  siteKey,
  nonce,
  resetKey,
  onToken,
}: {
  siteKey: string;
  nonce?: string;
  resetKey: string;
  onToken: (token: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let widgetId = "";

    ensureTurnstile(nonce, () => {
      if (cancelled || !container || !window.turnstile) return;
      container.replaceChildren();
      widgetId = window.turnstile.render(container, {
        sitekey: siteKey,
        theme: "light",
        callback: (token: string) => onTokenRef.current(token),
        "expired-callback": () => onTokenRef.current(""),
        "error-callback": () => onTokenRef.current(""),
      });
    });

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey, nonce, resetKey]);

  return <div ref={containerRef} data-turnstile="" className="min-h-[65px]" />;
}
