import { describe, expect, it } from "vitest";
import { maxProfileImageBytes, validateProfileImageBytes, validateProfileImageFile } from "@/lib/features/profile-images";

describe("profile image validation", () => {
  it("accepts supported images within the limit", () => {
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "avatar.png", { type: "image/png" });
    expect(validateProfileImageFile(file)).toMatchObject({ ok: true, extension: ".png", mimeType: "image/png" });
  });

  it("rejects unsupported and oversized files", () => {
    expect(validateProfileImageFile(new File(["x"], "avatar.svg", { type: "image/svg+xml" })).ok).toBe(false);
    const oversized = { name: "avatar.png", size: maxProfileImageBytes + 1 } as File;
    expect(validateProfileImageFile(oversized).ok).toBe(false);
  });

  it("checks image signatures", () => {
    expect(validateProfileImageBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]), ".png")).toBe(true);
    expect(validateProfileImageBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46]), ".png")).toBe(false);
    expect(validateProfileImageBytes(new Uint8Array([0xff, 0xd8, 0xff]), ".jpg")).toBe(true);
  });
});
