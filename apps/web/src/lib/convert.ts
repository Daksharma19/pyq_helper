import "server-only";
import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { PDFDocument } from "pdf-lib";
import sharp, { type Metadata, type OutputInfo } from "sharp";
import { converterEnv } from "@/env";
import type { ImageExt, OfficeExt } from "@/lib/upload-formats";

// Local conversion of uploads to PDF. Nothing leaves the server.
// - Images: sharp (EXIF rotation, downscale to A4 at 300 dpi, JPEG) + pdf-lib, one page each.
// - Office documents: LibreOffice in headless mode, if installed (see findSoffice()).

const run = promisify(execFile);

export class ConversionError extends Error {}

/** A4 at 300 dpi: plenty for reading and OCR, and keeps phone photos to a sane size. */
const MAX_IMAGE_PX = { width: 2480, height: 3508 };
/** Smaller than this is not a readable scan of a paper. */
const MIN_IMAGE_SHORT_SIDE = 300;
const MAX_IMAGE_PAGES = 50;
const A4_POINTS = { short: 595.28, long: 841.89 };

export async function imageToPdf(bytes: Uint8Array, ext: ImageExt): Promise<Uint8Array> {
  let meta: Metadata;
  try {
    meta = await sharp(bytes).metadata();
  } catch {
    throw new ConversionError("This image is damaged or can't be read.");
  }
  // Multi-page TIFFs become multi-page PDFs; for GIFs only the first frame is a page.
  const pages = ext === "tif" ? Math.min(meta.pages ?? 1, MAX_IMAGE_PAGES) : 1;

  const doc = await PDFDocument.create();
  // Fixed metadata keeps the output byte-identical for the same input.
  doc.setCreationDate(new Date(0));
  doc.setModificationDate(new Date(0));
  doc.setProducer("PYQ Helper");
  doc.setCreator("PYQ Helper");

  for (let page = 0; page < pages; page++) {
    let jpeg: { data: Buffer; info: OutputInfo };
    try {
      jpeg = await sharp(bytes, { page })
        .rotate() // apply EXIF orientation (phone photos)
        .flatten({ background: "#ffffff" }) // transparent PNGs render on white
        .resize({ ...MAX_IMAGE_PX, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });
    } catch {
      throw new ConversionError("This image is damaged or can't be read.");
    }
    const { width, height } = jpeg.info;
    if (Math.min(width, height) < MIN_IMAGE_SHORT_SIDE) {
      throw new ConversionError(
        `This image is too small to be a readable paper (${width}×${height} px). Upload a clearer scan or photo.`,
      );
    }
    // Portrait images get A4 portrait width, landscape ones A4 landscape; aspect is kept.
    const pageWidth = width > height ? A4_POINTS.long : A4_POINTS.short;
    const pageHeight = (pageWidth * height) / width;
    const image = await doc.embedJpg(jpeg.data);
    doc.addPage([pageWidth, pageHeight]).drawImage(image, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
    });
  }
  return doc.save({ useObjectStreams: true });
}

// ---------------------------------------------------------------------------- LibreOffice

const SOFFICE_CANDIDATES: Record<string, string[]> = {
  win32: [
    "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
    "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
  ],
  darwin: ["/Applications/LibreOffice.app/Contents/MacOS/soffice"],
  linux: ["/usr/bin/soffice", "/usr/bin/libreoffice", "/usr/lib/libreoffice/program/soffice"],
};

let sofficePath: Promise<string | null> | undefined;

/** Path to LibreOffice's `soffice`: SOFFICE_PATH, the usual install locations, or PATH. */
export function findSoffice(): Promise<string | null> {
  sofficePath ??= (async () => {
    const configured = converterEnv().SOFFICE_PATH;
    const candidates = [
      ...(configured ? [configured] : []),
      ...(SOFFICE_CANDIDATES[process.platform] ?? []),
    ];
    for (const candidate of candidates) {
      if (
        await access(candidate).then(
          () => true,
          () => false,
        )
      )
        return candidate;
    }
    try {
      await run("soffice", ["--version"], { timeout: 15_000, windowsHide: true });
      return "soffice";
    } catch {
      return null;
    }
  })();
  return sofficePath;
}

// One conversion at a time: LibreOffice is heavy, and admins upload papers one by one.
let queue: Promise<unknown> = Promise.resolve();
const OFFICE_TIMEOUT_MS = 90_000;

export async function officeToPdf(bytes: Uint8Array, ext: OfficeExt): Promise<Uint8Array> {
  const soffice = await findSoffice();
  if (!soffice) {
    throw new ConversionError(
      "Word, PowerPoint and OpenDocument files are converted with LibreOffice, which isn't installed on this server. Export the file as PDF and upload that, or install LibreOffice (see README).",
    );
  }
  const job = queue.then(() => convertWithSoffice(soffice, bytes, ext));
  queue = job.catch(() => undefined);
  return job;
}

async function convertWithSoffice(
  soffice: string,
  bytes: Uint8Array,
  ext: OfficeExt,
): Promise<Uint8Array> {
  const dir = await mkdtemp(path.join(tmpdir(), "pyq-convert-"));
  try {
    const input = path.join(dir, `input.${ext}`);
    await writeFile(input, bytes);
    await run(
      soffice,
      [
        // A private profile, so this never clashes with a LibreOffice the user has open.
        `-env:UserInstallation=${pathToFileURL(path.join(dir, "profile")).href}`,
        "--headless",
        "--norestore",
        "--nolockcheck",
        "--nodefault",
        "--convert-to",
        "pdf",
        "--outdir",
        dir,
        input,
      ],
      { timeout: OFFICE_TIMEOUT_MS, windowsHide: true },
    );
    return new Uint8Array(await readFile(path.join(dir, "input.pdf")));
  } catch (e) {
    if (e instanceof ConversionError) throw e;
    throw new ConversionError(
      "LibreOffice couldn't convert this document. It may be damaged or password-protected; export it as PDF and upload that.",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
