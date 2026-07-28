import { describe, expect, it } from "vitest";
import { sanitizeFilename, validateStudyMaterialBytes, validateStudyMaterialFile } from "@/lib/features/materials";

describe("study material helpers", () => {
  it("sanitizes unsafe file names", () => {
    expect(sanitizeFilename("../exam answers?.pdf")).toBe("exam answers_.pdf");
  });

  it("accepts PDF files with matching content signature", () => {
    const file = new File(["%PDF-1.7"], "chapter.pdf", { type: "application/pdf" });
    const validation = validateStudyMaterialFile(file);
    expect(validation.ok).toBe(true);
    expect(validateStudyMaterialBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46]), ".pdf")).toBe(true);
  });

  it("rejects extension spoofing when content does not match", () => {
    expect(validateStudyMaterialBytes(new Uint8Array([0x4e, 0x4f, 0x50, 0x45]), ".pdf")).toBe(false);
  });

  it("rejects unsupported file types", () => {
    const file = new File(["alert(1)"], "payload.exe", { type: "application/octet-stream" });
    expect(validateStudyMaterialFile(file).ok).toBe(false);
  });
});
