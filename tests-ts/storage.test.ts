import { describe, expect, it } from "vitest";
import { getPrivateObject, storageErrorIsNotFound } from "@/lib/storage";

describe("private object storage", () => {
  it("rejects traversal and unowned storage namespaces", async () => {
    await expect(getPrivateObject("../secret.txt")).rejects.toThrow("Invalid storage key");
    await expect(getPrivateObject("public/file.txt")).rejects.toThrow("Invalid storage key");
  });

  it("distinguishes missing objects from transient storage failures", () => {
    expect(storageErrorIsNotFound({ code: "ENOENT" })).toBe(true);
    expect(storageErrorIsNotFound({ name: "NoSuchKey" })).toBe(true);
    expect(storageErrorIsNotFound({ $metadata: { httpStatusCode: 404 } })).toBe(true);
    expect(storageErrorIsNotFound(new Error("timeout"))).toBe(false);
  });
});
