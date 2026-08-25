import { describe, expect, it } from "vitest";
import { parseIsoDate, parsePositiveInteger, sanitizePlain, summarizeText } from "@/lib/text";

describe("text helpers", () => {
  it("sanitizes plain input for note and task forms", () => {
    expect(sanitizePlain("  <b>Read</b>   chapter 4  ")).toBe("Read chapter 4");
  });

  it("keeps valid ISO dates and rejects invalid task dates", () => {
    expect(parseIsoDate("2026-07-23")).toBe("2026-07-23");
    expect(parseIsoDate("23/07/2026")).toBeNull();
    expect(parseIsoDate("2026-02-29")).toBeNull();
    expect(parseIsoDate("2026-04-31")).toBeNull();
    expect(parseIsoDate("2024-02-29")).toBe("2024-02-29");
    expect(parseIsoDate("")).toBeNull();
  });

  it("accepts only positive safe record identifiers", () => {
    expect(parsePositiveInteger("42")).toBe(42);
    expect(parsePositiveInteger("0")).toBeNull();
    expect(parsePositiveInteger("1.5")).toBeNull();
    expect(parsePositiveInteger("not-an-id")).toBeNull();
  });

  it("summarizes long notes deterministically", () => {
    const summary = summarizeText(
      "This is the first meaningful sentence for the study note. This is the second meaningful sentence for the summary. This third sentence should not be included.",
    );
    expect(summary).toContain("first meaningful sentence");
    expect(summary).toContain("second meaningful sentence");
    expect(summary).not.toContain("third sentence");
  });
});
