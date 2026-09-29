import { describe, expect, it } from "vitest";
import { classifyUpload, extensionOf, precheckUpload } from "./upload-formats";

describe("classifyUpload", () => {
  it("accepts PDFs, images and Office documents by their content", () => {
    expect(classifyUpload("pdf", "paper.pdf")).toEqual({ kind: "pdf" });
    expect(classifyUpload("jpg", "IMG_2041.JPG")).toMatchObject({ kind: "image", ext: "jpg" });
    expect(classifyUpload("tif", "scan.tiff")).toMatchObject({ kind: "image", ext: "tif" });
    expect(classifyUpload("docx", "t2.docx")).toMatchObject({ kind: "office", ext: "docx" });
    expect(classifyUpload("odp", "slides.odp")).toMatchObject({ kind: "office", ext: "odp" });
  });

  it("trusts content over the file name", () => {
    expect(classifyUpload("docx", "misnamed.pdf")).toMatchObject({ kind: "office", ext: "docx" });
    expect(classifyUpload("pdf", "really-a-pdf.docx")).toEqual({ kind: "pdf" });
    expect(classifyUpload("zip", "photo.jpg")).toMatchObject({
      kind: "rejected",
      message: expect.stringContaining("Archives"),
    });
  });

  it("tells legacy Office formats apart by extension", () => {
    expect(classifyUpload("cfb", "paper.doc")).toMatchObject({ kind: "office", ext: "doc" });
    expect(classifyUpload("cfb", "deck.PPT")).toMatchObject({ kind: "office", ext: "ppt" });
    expect(classifyUpload("cfb", "marks.xls")).toMatchObject({
      kind: "rejected",
      message: expect.stringContaining("Spreadsheets"),
    });
  });

  it("explains why a file is rejected", () => {
    expect(classifyUpload("heic", "IMG_1.HEIC")).toMatchObject({
      kind: "rejected",
      message: expect.stringContaining("JPEG"),
    });
    expect(classifyUpload("xlsx", "sheet.xlsx")).toMatchObject({
      message: expect.stringContaining("Export the sheet as PDF"),
    });
    expect(classifyUpload(undefined, "broken.pdf")).toMatchObject({
      message: expect.stringContaining("named like a PDF file but its contents aren't one"),
    });
    expect(classifyUpload(undefined, "notes.txt")).toMatchObject({
      message: expect.stringContaining("isn't a supported format. Upload a PDF, an image"),
    });
    expect(classifyUpload("mp4", "lecture.mp4")).toMatchObject({
      message: expect.stringContaining("(.mp4 content)"),
    });
  });
});

describe("extensionOf / precheckUpload", () => {
  it("normalises extensions", () => {
    expect(extensionOf("A.JPEG")).toBe("jpg");
    expect(extensionOf("scan.tiff")).toBe("tif");
    expect(extensionOf("noext")).toBe("");
  });

  it("rejects empty and oversized files before upload", () => {
    expect(precheckUpload({ name: "a.pdf", size: 0 })).toMatch(/empty/);
    expect(precheckUpload({ name: "a.pdf", size: 21 * 1024 * 1024 })).toMatch(/20 MB/);
    expect(precheckUpload({ name: "a.pdf", size: 1024 })).toBeNull();
  });
});
