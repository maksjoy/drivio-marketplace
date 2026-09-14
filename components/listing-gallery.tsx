"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ListingGalleryProps = {
  images: string[];
  alt: string;
  sold?: boolean;
};

type Point = { x: number; y: number };

export function ListingGallery({ images, alt, sold = false }: ListingGalleryProps) {
  const [selected, setSelected] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const touchStart = useRef<Point | null>(null);
  const panStart = useRef<Point>({ x: 0, y: 0 });
  const lastTapAt = useRef(0);

  const count = images.length;
  const active = images[selected] ?? null;

  const resetZoom = useCallback(() => {
    setZoomed(false);
    setPan({ x: 0, y: 0 });
  }, []);

  const previous = useCallback(() => {
    if (count < 2) return;
    resetZoom();
    setSelected((index) => (index - 1 + count) % count);
  }, [count, resetZoom]);

  const next = useCallback(() => {
    if (count < 2) return;
    resetZoom();
    setSelected((index) => (index + 1) % count);
  }, [count, resetZoom]);

  const closeViewer = useCallback(() => {
    setViewerOpen(false);
    resetZoom();
  }, [resetZoom]);

  const toggleZoom = useCallback(() => {
    setZoomed((value) => {
      if (value) setPan({ x: 0, y: 0 });
      return !value;
    });
  }, []);

  useEffect(() => {
    if (!viewerOpen) return;
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeViewer();
      if (event.key === "ArrowLeft" && !zoomed) previous();
      if (event.key === "ArrowRight" && !zoomed) next();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [viewerOpen, zoomed, closeViewer, previous, next]);

  function onTouchStart(event: React.TouchEvent) {
    const touch = event.touches[0];
    if (!touch) return;
    touchStart.current = { x: touch.clientX, y: touch.clientY };
    panStart.current = pan;
  }

  function onTouchMove(event: React.TouchEvent) {
    if (!zoomed || !touchStart.current) return;
    const touch = event.touches[0];
    if (!touch) return;
    event.preventDefault();

    const dx = touch.clientX - touchStart.current.x;
    const dy = touch.clientY - touchStart.current.y;
    const maxX = Math.max(80, window.innerWidth * 0.42);
    const maxY = Math.max(100, window.innerHeight * 0.34);
    setPan({
      x: Math.max(-maxX, Math.min(maxX, panStart.current.x + dx)),
      y: Math.max(-maxY, Math.min(maxY, panStart.current.y + dy)),
    });
  }

  function onTouchEnd(event: React.TouchEvent) {
    if (!touchStart.current) return;
    const touch = event.changedTouches[0];
    if (!touch) return;

    const dx = touch.clientX - touchStart.current.x;
    const dy = touch.clientY - touchStart.current.y;
    touchStart.current = null;

    if (!zoomed && Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      if (dx < 0) next();
      else previous();
      return;
    }

    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
      const now = Date.now();
      if (now - lastTapAt.current < 320) {
        toggleZoom();
        lastTapAt.current = 0;
      } else {
        lastTapAt.current = now;
      }
    }
  }

  if (!active) {
    return (
      <div className="flex aspect-[4/3] w-full max-w-full items-center justify-center rounded-2xl bg-prairie-100 text-prairie-500">
        Photo unavailable
      </div>
    );
  }

  return (
    <>
      <div className="min-w-0 max-w-full overflow-hidden">
        <div className="relative aspect-[4/3] w-full max-w-full overflow-hidden rounded-2xl bg-prairie-100">
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
          <div className="mt-3 flex max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-2" aria-label="Vehicle photos">
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
          className="fixed inset-0 z-[100] h-[100dvh] w-screen max-w-[100vw] overflow-hidden bg-black/95"
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{ touchAction: zoomed ? "none" : "pan-y" }}
        >
          <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))] text-white">
            <span className="rounded-full bg-black/55 px-3 py-1.5 text-sm font-semibold">{selected + 1} / {count}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={toggleZoom}
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

          <div className="flex h-full w-full items-center justify-center overflow-hidden px-2 py-16">
            <img
              src={active}
              alt={`${alt} — photo ${selected + 1}`}
              className="max-h-full max-w-full select-none object-contain will-change-transform"
              style={{
                transform: zoomed
                  ? `translate3d(${pan.x}px, ${pan.y}px, 0) scale(1.9)`
                  : "translate3d(0,0,0) scale(1)",
                transition: touchStart.current ? "none" : "transform 160ms ease-out",
              }}
              draggable={false}
              onDoubleClick={toggleZoom}
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
              <p className="pointer-events-none absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 max-w-[90vw] -translate-x-1/2 whitespace-nowrap rounded-full bg-black/55 px-3 py-1.5 text-xs text-white sm:hidden">
                Swipe to browse · double-tap to zoom
              </p>
            </>
          )}
        </div>
      )}
    </>
  );
}
