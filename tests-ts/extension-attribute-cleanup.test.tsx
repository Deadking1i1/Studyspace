import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExtensionAttributeCleanup } from "@/components/security/extension-attribute-cleanup";

describe("extension attribute cleanup", () => {
  it("targets Bitdefender bookkeeping attributes without hiding general hydration errors", () => {
    const markup = renderToStaticMarkup(<ExtensionAttributeCleanup />);
    expect(markup).toContain("/^bis_/i");
    expect(markup).toContain("MutationObserver");
    expect(markup).not.toContain("console.error");
  });
});
