import { describe, expect, it } from "vitest";
import { sanitizeFilename, studyMaterialStorageKey, validateStudyMaterialBytes, validateStudyMaterialFile } from "@/lib/features/materials";

describe("study material helpers", () => {
  function zipWithEntries(names: string[]) {
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    const centralEntries = names.map((name) => {
      const filename = Buffer.from(name);
      const entry = Buffer.alloc(46 + filename.length);
      entry.writeUInt32LE(0x02014b50, 0);
      entry.writeUInt16LE(filename.length, 28);
      filename.copy(entry, 46);
      return entry;
    });
    const centralDirectory = Buffer.concat(centralEntries);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(names.length, 8);
    eocd.writeUInt16LE(names.length, 10);
    eocd.writeUInt32LE(centralDirectory.length, 12);
    eocd.writeUInt32LE(localHeader.length, 16);
    return new Uint8Array(Buffer.concat([localHeader, centralDirectory, eocd]));
  }

  it("sanitizes unsafe file names", () => {
    expect(sanitizeFilename("../exam answers?.pdf")).toBe("exam answers_.pdf");
  });

  it("accepts PDF files with matching content signature", () => {
    const file = new File(["%PDF-1.7\n%%EOF"], "chapter.pdf", { type: "application/pdf" });
    const validation = validateStudyMaterialFile(file);
    expect(validation.ok).toBe(true);
    expect(validateStudyMaterialBytes(new TextEncoder().encode("%PDF-1.7\n%%EOF"), ".pdf")).toBe(true);
  });

  it("rejects extension spoofing when content does not match", () => {
    expect(validateStudyMaterialBytes(new Uint8Array([0x4e, 0x4f, 0x50, 0x45]), ".pdf")).toBe(false);
  });

  it("rejects unsupported file types", () => {
    const file = new File(["alert(1)"], "payload.exe", { type: "application/octet-stream" });
    expect(validateStudyMaterialFile(file).ok).toBe(false);
  });

  it("rejects a reported MIME type that conflicts with the extension", () => {
    const file = new File(["%PDF-1.7\n%%EOF"], "chapter.pdf", { type: "image/png" });
    expect(validateStudyMaterialFile(file).ok).toBe(false);
  });

  it("requires the expected Office package content instead of any ZIP file", () => {
    const fakeZip = new Uint8Array(32);
    fakeZip.set([0x50, 0x4b, 0x03, 0x04]);
    expect(validateStudyMaterialBytes(fakeZip, ".docx")).toBe(false);

    expect(validateStudyMaterialBytes(zipWithEntries(["[Content_Types].xml", "word/document.xml"]), ".docx")).toBe(true);
  });

  it("normalizes legacy absolute-path records to their private object key", () => {
    expect(studyMaterialStorageKey({
      storagePath: "C:\\old-project\\storage\\study-materials\\42-file.pdf",
      storedFilename: "42-file.pdf",
    })).toBe("study-materials/42-file.pdf");
    expect(() => studyMaterialStorageKey({ storagePath: "../../secret", storedFilename: "../secret" })).toThrow();
  });
});
