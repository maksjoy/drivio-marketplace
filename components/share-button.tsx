"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

async function copyText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Clipboard permissions can be restricted in embedded/mobile browsers.
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.setAttribute("aria-hidden", "true");
  textarea.className = "sr-only";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

export function ShareButton({ title }: { title: string }) {
  const [label, setLabel] = useState("Share");

  function resetLabel() {
    window.setTimeout(() => setLabel("Share"), 1600);
  }

  async function share() {
    const url = window.location.href;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, url });
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      // If native sharing fails, still offer a copy fallback below.
    }

    if (await copyText(url)) {
      setLabel("Link copied");
    } else {
      setLabel("Copy failed");
    }
    resetLabel();
  }

  return (
    <Button type="button" variant="secondary" size="sm" onClick={share} aria-live="polite" className="!rounded-full px-4 font-medium">
      {label}
    </Button>
  );
}
