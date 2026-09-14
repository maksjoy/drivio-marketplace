"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ListingGalleryProps = {
  images: string[];
  alt: string;
  sold?: boolean;
};

export function ListingGallery({ images, alt, sold = false }: ListingGalleryProps) {
  const [selected, setSelected] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const lastTapAt = useRef(0);

  const count = images.length;
  const active = images[selected] ?? null;

  const previous = useCallback(() => {
    if (count < 2) return;
    setZoomed(false);
    setSelected((index) => (index - 1 + count) % count);
  }, [count]);

  const next = useCallback(() => {
    if (count < 2) return;
    setZoomed(false);
    setSelected((index) => (index + 1) % count);
  }, [count]);

  const closeViewer = useCallback(() => {
    setViewerOpen(false);
    setZoomed(false);
  }, []);

  useEffect(() => {
    if (!viewerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeViewer();
      if (event.key === "ArrowLeft" && !zoomed) previous();
      if (event.key === "ArrowRight" && !zoomed) next();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [viewerOpen, zoomed, closeViewer, previous, next]);

  function onTouchStart(event: React.TouchEvent) {
    const touch = event.touches[0];
    touchStartX.current = touch?.clientX ?? null;
    touchStartY.current = touch?.clientY ?? null;
  }

  function onTouchEnd(event: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - touchStartX.current;
    const dy = touch.clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    if (!zoomed && Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      if (dx < 0) next();
      else previous();
      return;
    }

    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
      const now = Date.now();
      if (now - lastTapAt.current < 320) {
        setZoomed((value) => !value);
        lastTapAt.current = 0;
      } else {
        lastTapAt.current = now;
      }
    }
  }

  if (!active) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-prairie-100 text-prairie-500">
        Photo unavailable
      </div>
    );
  }

  return (
    <>
      <div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-prairie-100">
          {sold && <span className="absolute left-4 top-4 z-10 rounded-full bg-slate-950/90 px-4 py-2 text-sm font-bold text-white">SOLD</span>}
          <button
            type="button"
            className="block h-full w-full cursor-zoom-in"
            onClick={() => setViewerOpen(true)}
            aria-label={`Open photo ${selected + 1} of ${count} fullscreen`}
          >
            <img src={active} alt={alt} className="h-full w-full object-cover" />
          </button>
          {count > 1 && (
            <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/65 px-2.5 py-1 text-xs font-semibold text-white">
              {selected + 1} / {count}
            </span>
          )}
        </div>

        {count > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-2" aria-label="Vehicle photos">
            {images.map((src, index) => (
              <button
                key={`${src}-${index}`}
                type="button"
                onClick={() => setSelected(index)}
                className={`h-24 w-32 flex-none overflow-hidden rounded-lg border-2 ${selected === index ? "border-rig-700" : "border-transparent"}`}
                aria-label={`Show photo ${index + 1}`}
                aria-current={selected === index ? "true" : undefined}
              >
                <img src={src} alt={`${alt} — photo ${index + 1}`} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {viewerOpen && (
        <div
          className="fixed inset-0 z-[100] flex bg-black/95"
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))] text-white">
            <span className="rounded-full bg-black/55 px-3 py-1.5 text-sm font-semibold">{selected + 1} / {count}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setZoomed((value) => !value)}
                className="rounded-full bg-black/55 px-3 py-2 text-sm font-semibold"
                aria-label={zoomed ? "Zoom out" : "Zoom in"}
              >
                {zoomed ? "100%" : "2×"}
              </button>
              <button
                type="button"
                onClick={closeViewer}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-2xl leading-none"
                aria-label="Close photo viewer"
              >
                ×
              </button>
            </div>
          </div>

          <div className={`flex h-full w-full items-center justify-center ${zoomed ? "overflow-auto" : "overflow-hidden"}`}>
            <img
              src={active}
              alt={`${alt} — photo ${selected + 1}`}
              className={zoomed
                ? "max-h-none max-w-none scale-[2] select-none object-contain transition-transform duration-200"
                : "max-h-[100dvh] max-w-full select-none object-contain transition-transform duration-200"}
              draggable={false}
              onDoubleClick={() => setZoomed((value) => !value)}
            />
          </div>

          {count > 1 && !zoomed && (
            <>
              <button
                type="button"
                onClick={previous}
                className="absolute left-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-3xl text-white sm:flex"
                aria-label="Previous photo"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={next}
                className="absolute right-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-3xl text-white sm:flex"
                aria-label="Next photo"
              >
                ›
              </button>
              <p className="pointer-events-none absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1.5 text-xs text-white sm:hidden">
                Swipe to browse · double-tap to zoom
              </p>
            </>
          )}
        </div>
      )}
    </>
  );
}
