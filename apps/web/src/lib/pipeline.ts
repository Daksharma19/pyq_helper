import "server-only";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { createWorker, type Worker } from "tesseract.js";
import { extractText, getDocumentProxy, renderPageAsImage } from "unpdf";
import { onVercel } from "@/env";

// Reading uploads (type detection, conversion to PDF, validation) is in lib/paper-file.ts.

export type TextSource = "text-layer" | "ocr" | "none";

/** Below this many characters a "text layer" is scanner noise, not the paper's text. */
const MIN_TEXT = 40;
/** OCR costs a few seconds a page; papers are rarely longer than this. */
const OCR_PAGES = 8;

/**
 * The paper's text: the PDF's own text layer when it has one (born-digital PDFs, or scans
 * the scanner already OCR'd), otherwise OCR of the first pages. Never throws: a paper we
 * can't read comes back empty and the admin types the fields in.
 */
export async function paperText(bytes: Uint8Array): Promise<{ text: string; source: TextSource }> {
  try {
    // pdf.js may detach the buffer it is given, so every call gets a copy.
    const pdf = await getDocumentProxy(bytes.slice());
    const { text: layers } = await extractText(pdf, { mergePages: false });
    // Page by page: a paper can mix born-digital pages with scanned ones, and questions run
    // over several pages, so every page counts towards the question total.
    const parts: string[] = [];
    let ocrUsed = 0;
    for (let page = 1; page <= pdf.numPages; page++) {
      const layer = layers[page - 1] ?? "";
      if (layer.trim().length >= MIN_TEXT) parts.push(layer);
      else if (ocrUsed < OCR_PAGES) {
        ocrUsed++;
        parts.push(await ocrPage(bytes, page));
      }
    }
    const text = parts.join("\n");
    if (!text.trim()) return { text: "", source: "none" };
    return { text, source: ocrUsed ? "ocr" : "text-layer" };
  } catch (e) {
    console.error("paperText failed", e);
    return { text: "", source: "none" };
  }
}

// One Tesseract worker per server process, created on first use; jobs queue on it.
// English language data is downloaded once into .cache/tesseract (gitignored), or the temp
// dir on Vercel, where that's the only writable place.
let worker: Promise<Worker> | undefined;
function ocrWorker(): Promise<Worker> {
  worker ??= createWorker("eng", undefined, {
    cachePath: onVercel
      ? path.join(os.tmpdir(), "tesseract")
      : path.join(process.cwd(), ".cache", "tesseract"),
  }).catch((e: unknown) => {
    worker = undefined; // retry on the next paper instead of caching the failure
    throw e;
  });
  return worker;
}

/** Share of each side trimmed when OCR of the whole page reads badly. */
const MARGIN = 0.05;
/** Tesseract's mean word confidence (0-100) above which a page counts as read. */
const GOOD_OCR = 60;

async function ocrPage(bytes: Uint8Array, page: number): Promise<string> {
  // 2x scale (~150 dpi for A4) balances accuracy and speed for printed papers.
  const png = Buffer.from(
    await renderPageAsImage(bytes.slice(), page, {
      canvasImport: () => import("@napi-rs/canvas"),
      scale: 2,
    }),
  );
  const ocr = await ocrWorker();
  const read = async (image: Buffer) => {
    const { data } = await ocr.recognize(image);
    // Garbage from a sideways page is long but low-confidence; empty text scores nothing.
    return { text: data.text, score: data.text.trim().length >= MIN_TEXT ? data.confidence : 0 };
  };
  let best = await read(png);
  if (best.score >= GOOD_OCR) return best.text;
  // Retries, only for pages that read badly:
  // - dark strips along the edges of a photographed or scanned page (table, scanner lid) can
  //   make Tesseract return nothing for the whole page. The paper's own margins are wider
  //   than 5%, so trimming them loses no text;
  // - a photo taken sideways without an EXIF orientation reads as noise until turned.
  const { width = 0, height = 0 } = await sharp(png).metadata();
  const [dx, dy] = [Math.round(width * MARGIN), Math.round(height * MARGIN)];
  if (!dx || !dy) return best.text;
  const inner = await sharp(png)
    .extract({ left: dx, top: dy, width: width - 2 * dx, height: height - 2 * dy })
    .png()
    .toBuffer();
  for (const turn of [0, 90, 270]) {
    const image = turn ? await sharp(inner).rotate(turn).png().toBuffer() : inner;
    const attempt = await read(image);
    if (attempt.score > best.score) best = attempt;
    if (best.score >= GOOD_OCR) break;
  }
  return best.text;
}
