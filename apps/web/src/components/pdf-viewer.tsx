"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";

/*
 * Smooth in-page PDF viewer built on pdf.js.
 * - Pages flow in the normal page scroll (no nested scroller), each pre-sized so nothing jumps.
 * - Only pages within ~1.5 screens are rendered; far-away canvases are released.
 * - Zooming stretches the current canvas instantly, then swaps in a crisp render
 *   (double-buffered, so there is never a blank frame). The point under the viewport
 *   centre stays in place.
 * - Rendering matches the screen's pixel density (capped at 2x to bound memory).
 * pdf.js loads lazily, so the page itself stays light; its assets come from
 * /pdfjs/<version>/ (see scripts/copy-pdfjs.mjs).
 */

type Size = { w: number; h: number }; // PDF points at scale 1
type Props = { url: string; title: string };

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
const ZOOM_STEP = 1.25;
const RERENDER_DELAY_MS = 120;
const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

export function PdfViewer({ url, title }: Props) {
  const region = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(false);
  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [current, setCurrent] = useState(1);
  const anchor = useRef<{ page: number; fraction: number; viewportY: number } | null>(null);

  // Available width: measured synchronously before first paint (observers only fire while
  // the page is being rendered, so never in a background tab), then kept up to date.
  useLayoutEffect(() => {
    const el = region.current;
    if (!el) return;
    setWidth(Math.floor(el.getBoundingClientRect().width));
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Load the document and every page's size (cheap: page dictionaries, not content).
  useEffect(() => {
    let cancelled = false;
    let task: PDFDocumentLoadingTask | undefined;
    (async () => {
      const pdfjs = await import("pdfjs-dist");
      const base = `/pdfjs/${pdfjs.version}/`;
      pdfjs.GlobalWorkerOptions.workerSrc = `${base}pdf.worker.min.mjs`;
      task = pdfjs.getDocument({
        url,
        wasmUrl: `${base}wasm/`,
        iccUrl: `${base}iccs/`,
        standardFontDataUrl: `${base}standard_fonts/`,
        cMapUrl: `${base}cmaps/`,
        cMapPacked: true,
        enableXfa: false,
      });
      task.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
        if (total) setProgress(Math.min(1, loaded / total));
      };
      const loaded = await task.promise;
      const pageSizes = await Promise.all(
        Array.from({ length: loaded.numPages }, async (_, i) => {
          const v = (await loaded.getPage(i + 1)).getViewport({ scale: 1 });
          return { w: v.width, h: v.height };
        }),
      );
      if (!cancelled) {
        setSizes(pageSizes);
        setDoc(loaded);
      }
    })().catch(() => {
      if (!cancelled) setError(true);
    });
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [url]);

  // Fit-to-width scale, shared by all pages so mixed page sizes line up.
  const widest = sizes.reduce((m, s) => Math.max(m, s.w), 0);
  const fit = widest && width ? width / widest : 0;
  const scale = fit * zoom;

  // Current page = the last page whose top is above 40% of the viewport height.
  useEffect(() => {
    if (!doc) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const pages = region.current?.querySelectorAll<HTMLElement>("[data-page]") ?? [];
      let n = 1;
      for (const p of pages) {
        if (p.getBoundingClientRect().top <= window.innerHeight * 0.4) n = Number(p.dataset.page);
      }
      setCurrent(n);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [doc]);

  // Zoom around the point at the viewport centre.
  const zoomTo = useCallback((next: (z: number) => number) => {
    const pages = region.current?.querySelectorAll<HTMLElement>("[data-page]") ?? [];
    const centreY = window.innerHeight / 2;
    for (const p of pages) {
      const r = p.getBoundingClientRect();
      if (r.top <= centreY && r.bottom >= centreY) {
        anchor.current = {
          page: Number(p.dataset.page),
          fraction: (centreY - r.top) / r.height,
          viewportY: centreY,
        };
        break;
      }
    }
    setZoom((z) => clampZoom(next(z)));
  }, []);

  useLayoutEffect(() => {
    const a = anchor.current;
    anchor.current = null;
    if (!a) return;
    const el = region.current?.querySelector<HTMLElement>(`[data-page="${a.page}"]`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    window.scrollBy({ top: r.top + r.height * a.fraction - a.viewportY, behavior: "instant" });
  }, [zoom]);

  // Ctrl/Cmd + wheel zooms the paper, not the whole page.
  useEffect(() => {
    const el = region.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomTo((z) => z * Math.exp(-e.deltaY / 300));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomTo]);

  if (error) {
    return (
      <p className="rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-800">
        The preview couldn&apos;t be shown.{" "}
        <a href={url} className="underline">
          Open the PDF
        </a>{" "}
        instead.
      </p>
    );
  }

  return (
    <section
      ref={region}
      aria-label={`${title}: paper preview`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "+" || e.key === "=") zoomTo((z) => z * ZOOM_STEP);
        else if (e.key === "-") zoomTo((z) => z / ZOOM_STEP);
        else if (e.key === "0") zoomTo(() => 1);
        else return;
        e.preventDefault();
      }}
      className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
    >
      <div className="sticky top-0 z-10 mb-3 flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white/90 px-3 py-1.5 text-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <span className="tabular-nums text-slate-600 dark:text-slate-400" aria-live="polite">
          {doc ? `Page ${current} of ${doc.numPages}` : `Loading… ${Math.round(progress * 100)}%`}
        </span>
        <div className="flex items-center gap-1" role="group" aria-label="Zoom">
          <ToolButton
            label="Zoom out"
            disabled={!doc || zoom <= ZOOM_MIN}
            onClick={() => zoomTo((z) => z / ZOOM_STEP)}
          >
            −
          </ToolButton>
          <ToolButton label="Fit to width" disabled={!doc} onClick={() => zoomTo(() => 1)} wide>
            {Math.round(zoom * 100)}%
          </ToolButton>
          <ToolButton
            label="Zoom in"
            disabled={!doc || zoom >= ZOOM_MAX}
            onClick={() => zoomTo((z) => z * ZOOM_STEP)}
          >
            +
          </ToolButton>
        </div>
      </div>

      {/* Horizontal scroll only when zoomed past the width; vertical scroll is the page's. */}
      <div className="overflow-x-auto overscroll-x-contain">
        <div className="flex w-max min-w-full flex-col items-center gap-3 pb-2">
          {doc && fit
            ? sizes.map((s, i) => (
                <PdfPage
                  key={i}
                  doc={doc}
                  number={i + 1}
                  cssWidth={Math.floor(s.w * scale)}
                  cssHeight={Math.floor(s.h * scale)}
                />
              ))
            : // A4 placeholder so the layout doesn't jump when the first page arrives.
              width > 0 && (
                <div
                  className="w-full animate-pulse rounded bg-slate-100 dark:bg-slate-900"
                  style={{ aspectRatio: "1 / 1.414" }}
                />
              )}
        </div>
      </div>
    </section>
  );
}

function PdfPage({
  doc,
  number,
  cssWidth,
  cssHeight,
}: {
  doc: PDFDocumentProxy;
  number: number;
  cssWidth: number;
  cssHeight: number;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const el = holder.current;
    if (!el) return;
    // Start pages near the viewport right away instead of waiting for the observer's first
    // callback (a frame later, and never while the tab is in the background).
    const { top, bottom } = el.getBoundingClientRect();
    const margin = window.innerHeight * 1.5;
    if (bottom > -margin && top < window.innerHeight + margin) setNear(true);
    const io = new IntersectionObserver(([e]) => setNear(e!.isIntersecting), {
      rootMargin: "150% 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Render (or re-render after zoom/resize) while near the viewport.
  useEffect(() => {
    if (!near || cssWidth <= 0) return;
    let cancelled = false;
    let task: RenderTask | undefined;
    const hasCanvas = !!holder.current?.querySelector("canvas");
    const timer = setTimeout(
      async () => {
        try {
          const page = await doc.getPage(number);
          if (cancelled) return;
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.className = "absolute inset-0 size-full";
          canvas.setAttribute("aria-hidden", "true");
          task = page.render({ canvas, viewport });
          await task.promise;
          if (cancelled || !holder.current) return;
          const old = holder.current.querySelector("canvas");
          if (old) {
            old.replaceWith(canvas);
            old.width = old.height = 0; // free its backing store now, not at GC time
          } else {
            holder.current.appendChild(canvas);
          }
          setReady(true);
        } catch {
          // Cancelled (scrolled away / zoomed again) or a page-level error: keep the placeholder.
        }
      },
      hasCanvas ? RERENDER_DELAY_MS : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
      task?.cancel();
    };
  }, [near, cssWidth, doc, number]);

  // Release far-away pages.
  useEffect(() => {
    if (near) return;
    const canvas = holder.current?.querySelector("canvas");
    if (canvas) {
      canvas.width = canvas.height = 0;
      canvas.remove();
      setReady(false);
    }
  }, [near]);

  return (
    <div
      ref={holder}
      data-page={number}
      role="img"
      aria-label={`Page ${number}`}
      className={`relative shrink-0 overflow-hidden rounded-sm bg-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 ${ready ? "" : "animate-pulse"}`}
      style={{ width: cssWidth, height: cssHeight }}
    />
  );
}

function ToolButton({
  label,
  onClick,
  disabled,
  wide,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`h-8 rounded-md border border-slate-300 font-medium tabular-nums hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-900 ${wide ? "min-w-16 px-2 text-xs" : "w-8"}`}
    >
      {children}
    </button>
  );
}
