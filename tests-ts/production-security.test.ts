import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("production security invariants", () => {
  it("does not expose account tokens in production messages", () => {
    const source = readFileSync("lib/auth/actions.ts", "utf8");
    expect(source).not.toContain("devTokenMessage");
    expect(source).not.toContain("Development reset link:");
    expect(source).toContain("developmentMessage");
  });

  it("requires password and CSRF for account exports", () => {
    const source = readFileSync("app/api/account/export/route.ts", "utf8");
    expect(source).toContain("verifyCsrfToken");
    expect(source).toContain("verifyPassword");
    expect(source).toContain("export async function POST");
  });

  it("sets baseline browser security headers", () => {
    const source = readFileSync("next.config.ts", "utf8");
    for (const header of ["Content-Security-Policy", "Strict-Transport-Security", "X-Content-Type-Options", "Permissions-Policy"]) {
      expect(source).toContain(header);
    }
    expect(source).toContain('value: "strict-origin-when-cross-origin"');
    expect(source).not.toContain('value: "no-referrer"');
  });

  it("allows the validated five-megabyte profile image limit through Server Actions", () => {
    const source = readFileSync("next.config.ts", "utf8");
    expect(source).toContain('bodySizeLimit: "6mb"');
  });

  it("does not expose the Next.js development toolbar in the Study Space UI", () => {
    const source = readFileSync("next.config.ts", "utf8");
    expect(source).toContain("devIndicators: false");
  });

  it("uses the stable development compiler to avoid Turbopack reload panics", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts?: Record<string, string>;
    };
    expect(packageJson.scripts?.dev).toBe("next dev --webpack");
  });

  it("isolates development output from production builds", () => {
    const source = readFileSync("next.config.ts", "utf8");
    expect(source).toContain('process.env.NODE_ENV === "development"');
    expect(source).toContain('".next-study-space-dev"');
    expect(source).toContain('".next-study-space"');
  });

  it("revokes all sessions after credential changes", () => {
    const source = readFileSync("lib/auth/actions.ts", "utf8");
    expect(source.match(/revokeAllUserSessions\(user\.id\)/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
