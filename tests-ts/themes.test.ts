import { describe, expect, it } from "vitest";
import { normalizeTheme, themeDefinitions } from "@/lib/themes";

describe("theme registry", () => {
  it("contains the eight supported study environments", () => {
    expect(themeDefinitions.map((theme) => theme.id)).toEqual([
      "rain",
      "cyan",
      "ocean",
      "forest",
      "aurora",
      "purple",
      "light",
      "high-contrast",
    ]);
  });

  it("uses a unique optimized image for each environment", () => {
    const images = themeDefinitions.map((theme) => theme.image);

    expect(new Set(images).size).toBe(themeDefinitions.length);
    expect(images.every((image) => image.endsWith(".webp"))).toBe(true);
  });

  it("normalizes legacy and unsupported stored values safely", () => {
    expect(normalizeTheme("forest")).toBe("forest");
    expect(normalizeTheme("dark")).toBe("rain");
    expect(normalizeTheme("unknown")).toBe("rain");
    expect(normalizeTheme(null)).toBe("rain");
  });
});
