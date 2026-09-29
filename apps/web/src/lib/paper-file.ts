import "server-only";
import { fileTypeFromBuffer } from "file-type";
import { getDocumentProxy } from "unpdf";
import { sha256 } from "@pyq/db";
import { MAX_PDF_BYTES } from "@pyq/shared";
import { ConversionError, imageToPdf, officeToPdf } from "@/lib/convert";
import { classifyUpload, MAX_UPLOAD_BYTES, precheckUpload } from "@/lib/upload-formats";

// Pipeline step 0 for every upload (single, bulk, replace):
//   size check -> detect type from bytes -> convert to PDF locally -> validate the PDF.
// The source hash (of the uploaded bytes) is the file's identity, so the same photo or
// document uploaded twice is recognised even though its PDF is regenerated.

export type PaperFile = {
  /** SHA-256 of the uploaded bytes (stored as papers.file_hash). */
  sourceHash: string;
  pdf: Uint8Array<ArrayBuffer>;
  pages: number;
  /** Set when the upload wasn't a PDF, e.g. "JPEG image". */
  convertedFrom?: string;
};

export const MAX_PAGES = 50;

// Analyse and Save both read the file; cache conversions briefly so Save doesn't convert
// again (LibreOffice takes seconds). Per server process, bounded by entries and age.
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_MAX = 20;
const cache = new Map<string, { at: number; value: PaperFile }>();

function cached(hash: string): PaperFile | undefined {
  const hit = cache.get(hash);
  if (!hit || Date.now() - hit.at > CACHE_TTL_MS) return undefined;
  return hit.value;
}

function remember(value: PaperFile) {
  cache.set(value.sourceHash, { at: Date.now(), value });
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
}

export async function readPaperFile(
  file: FormDataEntryValue | null,
): Promise<PaperFile | { error: string }> {
  if (!(file instanceof File)) return { error: "Choose a file." };
  const pre = precheckUpload(file);
  if (pre) return { error: pre };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sourceHash = sha256(bytes);
  const hit = cached(sourceHash);
  if (hit) return hit;

  const detected = (await fileTypeFromBuffer(bytes))?.ext;
  const kind = classifyUpload(detected, file.name);
  let pdf: Uint8Array;
  try {
    if (kind.kind === "rejected") return { error: kind.message };
    pdf =
      kind.kind === "pdf"
        ? bytes
        : kind.kind === "image"
          ? await imageToPdf(bytes, kind.ext)
          : await officeToPdf(bytes, kind.ext);
  } catch (e) {
    if (e instanceof ConversionError) return { error: e.message };
    console.error("conversion failed", e);
    return { error: "This file couldn't be converted to PDF." };
  }

  if (pdf.byteLength > MAX_PDF_BYTES) {
    return {
      error:
        kind.kind === "pdf"
          ? "This PDF is larger than 20 MB."
          : "The converted PDF is larger than 20 MB. Upload a smaller or lower-resolution file.",
    };
  }
  const check = await validatePdf(pdf);
  if ("error" in check) return check;

  const result: PaperFile = {
    sourceHash,
    pdf: new Uint8Array(pdf) as Uint8Array<ArrayBuffer>,
    pages: check.pages,
    convertedFrom: kind.kind === "pdf" ? undefined : kind.label,
  };
  remember(result);
  return result;
}

/** Opens the PDF with pdf.js: catches password protection, damage and odd page counts. */
export async function validatePdf(pdf: Uint8Array): Promise<{ pages: number } | { error: string }> {
  try {
    const doc = await getDocumentProxy(pdf.slice()); // pdf.js may detach its input
    const pages = doc.numPages;
    await doc.cleanup();
    if (pages < 1) return { error: "This PDF has no pages." };
    if (pages > MAX_PAGES) {
      return {
        error: `This PDF has ${pages} pages. A question paper should have at most ${MAX_PAGES}; upload one paper per file.`,
      };
    }
    return { pages };
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    if (name === "PasswordException") {
      return { error: "This PDF is password-protected. Remove the password and upload it again." };
    }
    return { error: "This PDF is damaged and can't be opened." };
  }
}

export { MAX_UPLOAD_BYTES };
