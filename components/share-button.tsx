"use client";

import { useState } from "react";

export function ShareButton({ title }: { title: string }) {
  const [label, setLabel] = useState("Share");

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setLabel("Link copied");
      window.setTimeout(() => setLabel("Share"), 1600);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(url);
        setLabel("Link copied");
        window.setTimeout(() => setLabel("Share"), 1600);
      } catch {
        setLabel("Copy failed");
        window.setTimeout(() => setLabel("Share"), 1600);
      }
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="rounded-full border border-prairie-300 bg-white px-4 py-2 text-sm font-medium"
    >
      {label}
    </button>
  );
}
