import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isValidAccountEmail } from "@/lib/auth/email";
import { passwordStrengthErrors, verifyPassword } from "@/lib/auth/password";
import { parseRateLimit } from "@/lib/auth/rate-limit";

describe("auth security regressions", () => {
  it("validates account email addresses on the server", () => {
    expect(isValidAccountEmail("student@example.com")).toBe(true);
    expect(isValidAccountEmail("not-an-email")).toBe(false);
    expect(isValidAccountEmail(`student@${"a".repeat(250)}.com`)).toBe(false);
  });

  it("rejects oversized passwords and hostile password-hash parameters", () => {
    expect(passwordStrengthErrors(`Aa1!${"a".repeat(1021)}`)).toContain("Password is too long.");
    expect(verifyPassword("StrongPass1!", `pbkdf2:sha256:999999999$abc$${"00".repeat(32)}`)).toBe(false);
    expect(verifyPassword("StrongPass1!", `scrypt:1073741824:8:1$abc$${"00".repeat(64)}`)).toBe(false);
  });

  it("falls back when a configured rate limit is zero", () => {
    expect(parseRateLimit("0 per minute", 5, 60)).toEqual({ limit: 5, windowSeconds: 60 });
    expect(parseRateLimit("5 per 0 minute", 5, 60)).toEqual({ limit: 5, windowSeconds: 60 });
  });

  it("atomically consumes one-time account tokens", () => {
    const source = readFileSync("lib/auth/actions.ts", "utf8");
    expect(source).toContain("eq(users.passwordResetTokenHash, hashToken(token))");
    expect(source).toContain("eq(users.emailVerificationTokenHash, hashToken(token))");
    expect(source).toContain("eq(users.pendingEmailTokenHash, hashToken(token))");
    expect(source.match(/\.returning\(\)/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("marks account exports as private and non-cacheable", () => {
    const source = readFileSync("app/api/account/export/route.ts", "utf8");
    expect(source).toContain('"cache-control": "private, no-store, max-age=0"');
    expect(source).toContain('"x-content-type-options": "nosniff"');
  });

  it("requires CSRF form data for every account lifecycle action", () => {
    const source = readFileSync("lib/auth/actions.ts", "utf8");
    expect(source).not.toMatch(/logoutAction\(formData\?:/);
    expect(source).not.toMatch(/verifyEmailAction\(token: string, formData\?:/);
    expect(source).not.toMatch(/resendVerificationAction\(formData\?:/);
    expect(source).not.toMatch(/confirmEmailChangeAction\(token: string, formData\?:/);
  });

  it("exposes secure global sign out controls", () => {
    const shell = readFileSync("components/shell/theme-shell.tsx", "utf8");
    const route = readFileSync("app/api/auth/logout/route.ts", "utf8");
    expect(shell.match(/action="\/api\/auth\/logout"/g)?.length).toBe(2);
    expect(shell.match(/name="csrf_token"/g)?.length).toBe(2);
    expect(route).toContain('logSecurityEvent(user.id, "auth.logout"');
    expect(route).toContain("303");
  });
});
