import "server-only";
import path from "node:path";
import { createWorker, type Worker } from "tesseract.js";
import { extractText, getDocumentProxy, renderPageAsImage } from "unpdf";

// Reading uploads (type detection, conversion to PDF, validation) is in lib/paper-file.ts.

export type TextSource = "text-layer" | "ocr" | "none";

/** Below this many characters a "text layer" is scanner noise, not the paper's text. */
const MIN_TEXT = 40;
/** The header (course, term, year, marks) is on page 1; questions rarely run past page 2. */
const OCR_PAGES = 2;

/**
 * The paper's text: the PDF's own text layer when it has one (born-digital PDFs, or scans
 * the scanner already OCR'd), otherwise OCR of the first pages. Never throws: a paper we
 * can't read comes back empty and the admin types the fields in.
 */
export async function paperText(bytes: Uint8Array): Promise<{ text: string; source: TextSource }> {
  try {
    // pdf.js may detach the buffer it is given, so every call gets a copy.
    const pdf = await getDocumentProxy(bytes.slice());
    const { text } = await extractText(pdf, { mergePages: false });
    const layer = text.slice(0, 3).join("\n");
    if (layer.trim().length >= MIN_TEXT) return { text: layer, source: "text-layer" };

    const parts: string[] = [];
    for (let page = 1; page <= Math.min(pdf.numPages, OCR_PAGES); page++) {
      parts.push(await ocrPage(bytes, page));
    }
    const ocr = parts.join("\n");
    return ocr.trim() ? { text: ocr, source: "ocr" } : { text: "", source: "none" };
  } catch (e) {
    console.error("paperText failed", e);
    return { text: "", source: "none" };
  }
}

// One Tesseract worker per server process, created on first use; jobs queue on it.
// English language data is downloaded once into .cache/tesseract (gitignored).
let worker: Promise<Worker> | undefined;
function ocrWorker(): Promise<Worker> {
  worker ??= createWorker("eng", undefined, {
    cachePath: path.join(process.cwd(), ".cache", "tesseract"),
  }).catch((e: unknown) => {
    worker = undefined; // retry on the next paper instead of caching the failure
    throw e;
  });
  return worker;
}

async function ocrPage(bytes: Uint8Array, page: number): Promise<string> {
  // 2x scale (~150 dpi for A4) balances accuracy and speed for printed papers.
  const png = await renderPageAsImage(bytes.slice(), page, {
    canvasImport: () => import("@napi-rs/canvas"),
    scale: 2,
  });
  const { data } = await (await ocrWorker()).recognize(Buffer.from(png));
  return data.text;
}
