// Which uploads the paper pipeline accepts, and how each is turned into a PDF.
// Pure and browser-safe: the upload UI uses ACCEPT and the size limit; the server uses
// classifyUpload() on the *detected* type (magic bytes), never the file name alone.

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const IMAGE_EXTS = ["jpg", "png", "webp", "tif", "gif", "avif"] as const;
const OFFICE = {
  docx: "Word document (DOCX)",
  doc: "Word document (DOC)",
  odt: "OpenDocument text (ODT)",
  rtf: "Rich Text document (RTF)",
  pptx: "PowerPoint (PPTX)",
  ppt: "PowerPoint (PPT)",
  odp: "OpenDocument presentation (ODP)",
} as const;
const IMAGE_LABEL: Record<(typeof IMAGE_EXTS)[number], string> = {
  jpg: "JPEG image",
  png: "PNG image",
  webp: "WebP image",
  tif: "TIFF image",
  gif: "GIF image",
  avif: "AVIF image",
};

export type OfficeExt = keyof typeof OFFICE;
export type ImageExt = (typeof IMAGE_EXTS)[number];

/** For <input accept>: extensions plus MIME types (phones filter pickers by MIME). */
export const ACCEPT = [
  ".pdf,application/pdf",
  ".jpg,.jpeg,.png,.webp,.tif,.tiff,.gif,.avif,image/jpeg,image/png,image/webp,image/tiff,image/gif,image/avif",
  ".doc,.docx,.odt,.rtf,.ppt,.pptx,.odp",
].join(",");

export const SUPPORTED_TEXT =
  "a PDF, an image (JPG, PNG, WebP, TIFF, GIF, AVIF) or a document (DOCX, DOC, ODT, RTF, PPTX, PPT, ODP)";

/** Lowercase extension of a file name, with .jpeg/.tiff folded into jpg/tif. */
export function extensionOf(name: string): string {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? "";
  return ({ jpeg: "jpg", jpe: "jpg", tiff: "tif" } as Record<string, string>)[ext] ?? ext;
}

/** By name only: for picking paper files out of a folder (which may hold CSVs, notes...). */
export function hasSupportedExtension(name: string): boolean {
  const ext = extensionOf(name);
  return ext === "pdf" || (IMAGE_EXTS as readonly string[]).includes(ext) || ext in OFFICE;
}

/** Cheap client-side check (by name and size) so obviously bad files fail before uploading. */
export function precheckUpload(file: { name: string; size: number }): string | null {
  if (file.size === 0) return "This file is empty.";
  if (file.size > MAX_UPLOAD_BYTES) return "This file is larger than 20 MB.";
  return null;
}

export type Classified =
  | { kind: "pdf" }
  | { kind: "image"; ext: ImageExt; label: string }
  | { kind: "office"; ext: OfficeExt; label: string }
  | { kind: "rejected"; message: string };

/**
 * Decides what to do with an upload from its detected type (file-type's `ext`, undefined
 * when the bytes match no known signature) and its name. The content wins over the name:
 * a Word file named .pdf is converted, a ZIP named .jpg is rejected.
 */
export function classifyUpload(detected: string | undefined, fileName: string): Classified {
  const name = fileName || "This file";
  if (detected === "pdf") return { kind: "pdf" };
  if (detected && (IMAGE_EXTS as readonly string[]).includes(detected)) {
    const ext = detected as ImageExt;
    return { kind: "image", ext, label: IMAGE_LABEL[ext] };
  }
  if (detected && detected in OFFICE) {
    const ext = detected as OfficeExt;
    return { kind: "office", ext, label: OFFICE[ext] };
  }
  // Legacy Office files share one container format (CFB); the extension tells them apart.
  if (detected === "cfb") {
    const ext = extensionOf(name);
    if (ext === "doc" || ext === "ppt") return { kind: "office", ext, label: OFFICE[ext] };
    if (ext === "xls") return { kind: "rejected", message: SPREADSHEET };
    return unsupported(name, "an Office file of an unknown kind");
  }
  if (detected === "heic" || detected === "heif") {
    return {
      kind: "rejected",
      message:
        "iPhone HEIC photos can't be converted here. Share or export the photo as JPEG (or set Camera → Formats → Most Compatible) and upload that.",
    };
  }
  if (detected === "xlsx" || detected === "ods") return { kind: "rejected", message: SPREADSHEET };
  if (detected === "zip" || detected === "rar" || detected === "7z" || detected === "gz") {
    return {
      kind: "rejected",
      message: "Archives (ZIP, RAR, 7z) aren't supported. Extract the files and upload them.",
    };
  }
  const ext = extensionOf(name);
  if (!detected && (ext === "pdf" || (IMAGE_EXTS as readonly string[]).includes(ext))) {
    return {
      kind: "rejected",
      message: `“${name}” is named like a ${ext.toUpperCase()} file but its contents aren't one. It may be damaged or only partly downloaded.`,
    };
  }
  return unsupported(name, detected ? `.${detected} content` : undefined);
}

const SPREADSHEET = "Spreadsheets aren't supported. Export the sheet as PDF and upload that.";

function unsupported(name: string, what?: string): Classified {
  return {
    kind: "rejected",
    message: `“${name}” isn't a supported format${what ? ` (${what})` : ""}. Upload ${SUPPORTED_TEXT}.`,
  };
}
