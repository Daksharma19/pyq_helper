"use client";

import { useEffect, useRef, useState } from "react";
import { btnPrimary, btnSecondary } from "@/components/admin/styles";

/** Longest side of each page image. Enough for OCR, small enough to upload quickly. */
const MAX_SIDE = 2000;
const JPEG_QUALITY = 0.85;

type Shot = { id: string; file: File; url: string };

/**
 * Phones only (touch screen): take photos of a paper page by page with the camera, then
 * upload them together as one PDF, since a paper usually runs over several pages.
 * Photos are downscaled and combined on the device; the PDF then goes through the same
 * pipeline as any upload.
 */
export function CameraCapture({ onPaper }: { onPaper: (pdf: File) => void }) {
  const [mobile, setMobile] = useState(false);
  const [shots, setShots] = useState<Shot[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse) and (hover: none)");
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Free the thumbnails' memory when the tray is cleared or the page closes.
  const shotsRef = useRef(shots);
  shotsRef.current = shots;
  useEffect(() => () => shotsRef.current.forEach((s) => URL.revokeObjectURL(s.url)), []);

  if (!mobile) return null;

  function addShots(files: FileList) {
    setError(undefined);
    const fresh = [...files]
      .filter((f) => f.type.startsWith("image/") || f.type === "")
      .map((file) => ({
        id: `${Date.now()}-${Math.random()}`,
        file,
        url: URL.createObjectURL(file),
      }));
    setShots((list) => [...list, ...fresh]);
  }

  function remove(id: string) {
    setShots((list) => {
      const gone = list.find((s) => s.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return list.filter((s) => s.id !== id);
    });
  }

  function move(i: number, by: -1 | 1) {
    setShots((list) => {
      const j = i + by;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  }

  async function finish() {
    setBusy(true);
    setError(undefined);
    try {
      const pdf = await photosToPdf(shots.map((s) => s.file));
      onPaper(pdf);
      shots.forEach((s) => URL.revokeObjectURL(s.url));
      setShots([]);
    } catch {
      setError("Could not read one of the photos. Remove it and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) addShots(e.target.files);
          e.target.value = "";
        }}
      />
      {shots.length === 0 ? (
        <>
          <button
            type="button"
            className={`${btnPrimary} w-full`}
            onClick={() => input.current?.click()}
          >
            Take photos of a paper
          </button>
          <p className="text-sm text-slate-500">
            Photograph each page in order. You can add as many pages as the paper has, then upload
            them together as one paper.
          </p>
        </>
      ) : (
        <>
          <p className="font-medium">
            {shots.length} page{shots.length === 1 ? "" : "s"}, in order
          </p>
          <ol className="grid grid-cols-3 gap-2">
            {shots.map((s, i) => (
              <li key={s.id} className="space-y-1">
                <div className="relative">
                  <img
                    src={s.url}
                    alt={`Page ${i + 1}`}
                    className="aspect-[3/4] w-full rounded-md border border-slate-200 object-cover dark:border-slate-700"
                  />
                  <span className="absolute top-1 left-1 rounded bg-black/70 px-1.5 text-xs text-white">
                    {i + 1}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <button
                    type="button"
                    aria-label={`Move page ${i + 1} earlier`}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    className="px-2 py-1 disabled:opacity-30"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(s.id)}
                    className="px-2 py-1 text-red-600 dark:text-red-400"
                  >
                    Remove
                  </button>
                  <button
                    type="button"
                    aria-label={`Move page ${i + 1} later`}
                    disabled={i === shots.length - 1}
                    onClick={() => move(i, 1)}
                    className="px-2 py-1 disabled:opacity-30"
                  >
                    →
                  </button>
                </div>
              </li>
            ))}
          </ol>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={btnSecondary}
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              + Add page
            </button>
            <button type="button" className={btnPrimary} disabled={busy} onClick={finish}>
              {busy ? "Preparing…" : `Upload ${shots.length} page${shots.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** One PDF page per photo, each scaled to fit and re-encoded as JPEG (handles HEIC too). */
async function photosToPdf(files: File[]): Promise<File> {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  for (const file of files) {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("encode"))),
        "image/jpeg",
        JPEG_QUALITY,
      ),
    );
    const jpg = await doc.embedJpg(await blob.arrayBuffer());
    // A4 width in points; height follows the photo's aspect ratio.
    const width = 595;
    const height = (jpg.height / jpg.width) * width;
    doc.addPage([width, height]).drawImage(jpg, { x: 0, y: 0, width, height });
  }
  const bytes = await doc.save();
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  return new File([bytes as BlobPart], `camera-${stamp}.pdf`, { type: "application/pdf" });
}
