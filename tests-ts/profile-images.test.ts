import { describe, expect, it } from "vitest";
import { maxProfileImageBytes, validateProfileImageBytes, validateProfileImageFile } from "@/lib/features/profile-images";

describe("profile image validation", () => {
  function png(width = 1, height = 1) {
    const bytes = new Uint8Array(33);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    new DataView(bytes.buffer).setUint32(8, 13);
    bytes.set([0x49, 0x48, 0x44, 0x52], 12);
    new DataView(bytes.buffer).setUint32(16, width);
    new DataView(bytes.buffer).setUint32(20, height);
    return bytes;
  }

  it("accepts supported images within the limit", () => {
    const file = new File([png()], "avatar.png", { type: "image/png" });
    expect(validateProfileImageFile(file)).toMatchObject({ ok: true, extension: ".png", mimeType: "image/png" });
  });

  it("rejects unsupported and oversized files", () => {
    expect(validateProfileImageFile(new File(["x"], "avatar.svg", { type: "image/svg+xml" })).ok).toBe(false);
    const oversized = { name: "avatar.png", size: maxProfileImageBytes + 1 } as File;
    expect(validateProfileImageFile(oversized).ok).toBe(false);
  });

  it("checks image signatures", () => {
    expect(validateProfileImageBytes(png(), ".png")).toBe(true);
    expect(validateProfileImageBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46]), ".png")).toBe(false);
    expect(validateProfileImageBytes(new Uint8Array([0xff, 0xd8, 0xff]), ".jpg")).toBe(false);
    expect(validateProfileImageBytes(new Uint8Array([
      0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x01, 0x00, 0x01,
      0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00, 0xff, 0xd9,
    ]), ".jpg")).toBe(true);
  });

  it("rejects image dimensions that could exhaust processing memory", () => {
    expect(validateProfileImageBytes(png(10_000, 10_000), ".png")).toBe(false);
  });

  it("rejects a reported MIME type that conflicts with the image extension", () => {
    const file = new File([png()], "avatar.png", { type: "image/jpeg" });
    expect(validateProfileImageFile(file).ok).toBe(false);
  });
});
