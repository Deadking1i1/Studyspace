import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyThemeBrand } from "@/lib/client/theme-brand";

const picker = readFileSync("components/settings/theme-picker.tsx", "utf8");
const shell = readFileSync("components/shell/theme-shell.tsx", "utf8");
const styles = readFileSync("app/globals.css", "utf8");

describe("theme UI architecture", () => {
  it("keeps the shell theme and branding under one React state owner", () => {
    expect(shell).toContain("data-theme={theme}");
    expect(shell).toContain("src={brandTheme.logo}");
    expect(shell).toContain("applyThemeBrand(theme)");
    expect(picker).toContain("useStudyTheme()");
  });

  it("does not mutate the shell or refresh the route after a selection", () => {
    expect(picker).not.toContain('querySelector<HTMLElement>(".app-shell")');
    expect(picker).not.toContain("router.refresh()");
    expect(picker).not.toContain('type="submit"');
  });

  it("serializes saves so the final selection is persisted last", () => {
    expect(picker).toContain("saveQueue.current = saveQueue.current.then");
    expect(picker).toContain("latestSelection.current === theme");
  });

  it("updates the favicon with the selected theme and cache key", () => {
    const favicon = { href: "", id: "study-space-favicon", rel: "", type: "" };
    const previousDocument = globalThis.document;
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        createElement: () => favicon,
        head: { append: () => undefined },
        querySelector: () => favicon,
      },
    });

    try {
      applyThemeBrand("forest");
      expect(favicon.href).toBe("/assets/brand/favicon-forest.png?theme=forest");
      expect(favicon.type).toBe("image/png");
    } finally {
      if (previousDocument) {
        Object.defineProperty(globalThis, "document", { configurable: true, value: previousDocument });
      } else {
        Reflect.deleteProperty(globalThis, "document");
      }
    }
  });

  it("uses a mobile-safe scrolling theme background", () => {
    expect(styles).toContain("var(--theme-background) 58% center / cover scroll no-repeat");
  });
});
