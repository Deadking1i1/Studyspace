import { describe, expect, it } from "vitest";
import { env } from "@/lib/env";

describe("env", () => {
  it("loads safe development defaults", () => {
    expect(env.STUDY_SPACE_APP_BASE_URL).toMatch(/^http/);
    expect(env.AUTH_SECRET.length).toBeGreaterThanOrEqual(32);
  });
});
