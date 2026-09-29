import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { readPaperFile, validatePdf } from "./paper-file";

// End-to-end tests of upload -> detect -> convert -> validate, with files built in memory.

const file = (bytes: Uint8Array | string, name: string) =>
  new File([typeof bytes === "string" ? bytes : Buffer.from(bytes)], name);

/** A white "scan" with a dark bar, like a photographed page. */
async function scanImage(width: number, height: number, format: "jpeg" | "png" | "tiff") {
  const bar = await sharp({
    create: { width: Math.floor(width / 2), height: 40, channels: 3, background: "#222" },
  })
    .png()
    .toBuffer();
  return new Uint8Array(
    await sharp({ create: { width, height, channels: 3, background: "#fff" } })
      .composite([{ input: bar, top: 80, left: 60 }])
      .toFormat(format)
      .toBuffer(),
  );
}

async function pageSizes(pdf: Uint8Array) {
  const doc = await PDFDocument.load(pdf);
  return doc.getPages().map((p) => p.getSize());
}

describe("readPaperFile", () => {
  it("passes PDFs through unchanged, hashed by their bytes", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([595, 842]);
    const bytes = await doc.save();
    const res = await readPaperFile(file(bytes, "paper.pdf"));
    expect(res).toMatchObject({ pages: 1, convertedFrom: undefined });
    if ("error" in res) throw new Error(res.error);
    expect(Buffer.from(res.pdf).equals(Buffer.from(bytes))).toBe(true);
    expect(res.sourceHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("converts a phone photo (JPEG) to a one-page A4-width PDF", async () => {
    const res = await readPaperFile(file(await scanImage(1200, 1700, "jpeg"), "IMG_2041.jpg"));
    if ("error" in res) throw new Error(res.error);
    expect(res).toMatchObject({ pages: 1, convertedFrom: "JPEG image" });
    const [size] = await pageSizes(res.pdf);
    expect(size!.width).toBeCloseTo(595.28, 1);
    expect(size!.height).toBeCloseTo((595.28 * 1700) / 1200, 1);
  });

  it("uses A4 landscape width for landscape images and converts PNGs", async () => {
    const res = await readPaperFile(file(await scanImage(1600, 1000, "png"), "wide.png"));
    if ("error" in res) throw new Error(res.error);
    expect(res.convertedFrom).toBe("PNG image");
    expect((await pageSizes(res.pdf))[0]!.width).toBeCloseTo(841.89, 1);
  });

  it("turns a multi-page TIFF into a multi-page PDF", async () => {
    const page = await scanImage(800, 1100, "png");
    const tiff = new Uint8Array(
      await sharp([Buffer.from(page), Buffer.from(page)], { join: { animated: true } })
        .tiff()
        .toBuffer(),
    );
    const res = await readPaperFile(file(tiff, "scan.tiff"));
    if ("error" in res) throw new Error(res.error);
    expect(res).toMatchObject({ pages: 2, convertedFrom: "TIFF image" });
  });

  it("produces identical PDFs for identical images (stable, cacheable output)", async () => {
    const img = await scanImage(900, 1200, "jpeg");
    const a = await readPaperFile(file(img, "a.jpg"));
    const b = await readPaperFile(file(img.slice(), "b.jpg"));
    if ("error" in a || "error" in b) throw new Error("conversion failed");
    expect(a.sourceHash).toBe(b.sourceHash);
    expect(Buffer.from(a.pdf).equals(Buffer.from(b.pdf))).toBe(true);
  });

  it("rejects images too small to be a readable paper", async () => {
    const res = await readPaperFile(file(await scanImage(200, 150, "png"), "thumb.png"));
    expect(res).toEqual({ error: expect.stringContaining("too small to be a readable paper") });
  });

  it("rejects unsupported and disguised files with a clear message", async () => {
    expect(await readPaperFile(file("just some notes", "notes.txt"))).toEqual({
      error: expect.stringContaining("isn't a supported format"),
    });
    expect(await readPaperFile(file("<html>not a pdf</html>", "paper.pdf"))).toEqual({
      error: expect.stringContaining("named like a PDF file"),
    });
    expect(await readPaperFile(file("", "empty.pdf"))).toEqual({ error: "This file is empty." });
  });

  it("rejects damaged PDFs", async () => {
    const res = await readPaperFile(file("%PDF-1.7\n1 0 obj << /Type /Catalog", "cut.pdf"));
    expect(res).toEqual({ error: "This PDF is damaged and can't be opened." });
  });

  it("explains when Office conversion isn't available", async () => {
    // No LibreOffice at SOFFICE_PATH (and none on this test machine's PATH either).
    const { officeToPdf } = await import("./convert");
    process.env.SOFFICE_PATH = "Z:\\nowhere\\soffice.exe";
    await expect(officeToPdf(new Uint8Array([1, 2, 3]), "docx")).rejects.toThrow(
      /LibreOffice|couldn't convert/,
    );
  });
});

describe("validatePdf", () => {
  it("counts pages", async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    doc.addPage();
    expect(await validatePdf(await doc.save())).toEqual({ pages: 2 });
  });
});
