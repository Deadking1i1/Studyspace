import { describe, expect, it } from "vitest";
import { betaAllowedEmails } from "@/lib/beta-access";

describe("private beta access", () => {
  it("normalizes and deduplicates allow-listed addresses", () => {
    expect([...betaAllowedEmails(" A@Example.com, b@example.com,a@example.com ")]).toEqual(["a@example.com", "b@example.com"]);
  });
});
