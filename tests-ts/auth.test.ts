import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { addHours, createToken, hashToken } from "@/lib/auth/tokens";
import { hashPassword, passwordStrengthErrors, verifyPassword } from "@/lib/auth/password";
import { normalizeEmail } from "@/lib/account";

describe("auth password helpers", () => {
  it("creates Werkzeug-compatible scrypt hashes and verifies them", () => {
    const stored = hashPassword("Correct Horse Battery 9!");
    expect(stored.startsWith("scrypt:32768:8:1$")).toBe(true);
    expect(verifyPassword("Correct Horse Battery 9!", stored)).toBe(true);
    expect(verifyPassword("wrong password", stored)).toBe(false);
  });

  it("verifies existing Werkzeug pbkdf2 hashes", () => {
    const stored = "pbkdf2:sha256:1000$oDZO$8f81c884a8b7ee35f64373834cc75385e72be98d956fbf4e7e6f7256972a2bc4";
    expect(verifyPassword("password", stored)).toBe(true);
    expect(verifyPassword("Password", stored)).toBe(false);
  });

  it("enforces the migrated password strength rules", () => {
    expect(passwordStrengthErrors("A1!aaaa")).toContain("Password must be at least 8 characters long.");
    expect(passwordStrengthErrors("longbutmissingnumber!")).toContain("Password must include an uppercase letter.");
    expect(passwordStrengthErrors("Aa12345!")).toEqual([]);
  });
});

describe("auth token helpers", () => {
  it("creates opaque tokens and hashes them with sha256", () => {
    const token = createToken();
    expect(token.length).toBeGreaterThan(32);
    expect(hashToken(token)).toBe(createHash("sha256").update(token, "utf8").digest("hex"));
  });

  it("adds and subtracts hours", () => {
    const base = new Date("2026-07-23T12:00:00Z");
    expect(addHours(base, 2).toISOString()).toBe("2026-07-23T14:00:00.000Z");
    expect(addHours(base, -2).toISOString()).toBe("2026-07-23T10:00:00.000Z");
  });
});

describe("account normalization", () => {
  it("normalizes user email consistently with Flask", () => {
    expect(normalizeEmail("  Student@Example.COM ")).toBe("student@example.com");
  });
});
