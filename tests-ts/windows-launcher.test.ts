import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");

describe("Windows launcher", () => {
  it("provides a root-level double-click launcher", async () => {
    const launcher = await readFile(resolve(projectRoot, "Open Study Space.bat"), "utf8");

    expect(launcher).toContain("scripts\\start-study-space.ps1");
    expect(launcher).toContain("%~dp0");
  });

  it("waits for the application health endpoint before opening", async () => {
    const starter = await readFile(
      resolve(projectRoot, "scripts", "start-study-space.ps1"),
      "utf8",
    );

    expect(starter).toContain("/api/health");
    expect(starter).toContain("npm.cmd");
    expect(starter).toContain("Study Space did not become ready");
  });
});
