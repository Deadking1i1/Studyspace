import { randomBytes, scryptSync, pbkdf2Sync, timingSafeEqual } from "node:crypto";

export function passwordStrengthErrors(password: string) {
  const errors: string[] = [];
  if ((password || "").length < 8) errors.push("Password must be at least 8 characters long.");
  if (!/[A-Z]/.test(password || "")) errors.push("Password must include an uppercase letter.");
  if (!/[a-z]/.test(password || "")) errors.push("Password must include a lowercase letter.");
  if (!/\d/.test(password || "")) errors.push("Password must include a number.");
  if (!/[^A-Za-z0-9]/.test(password || "")) errors.push("Password must include a symbol.");
  return errors;
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  }).toString("hex");
  return `scrypt:32768:8:1$${salt}$${hash}`;
}

function safeCompareHex(actualHex: string, expectedHex: string) {
  const actual = Buffer.from(actualHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function verifyScrypt(password: string, storedHash: string) {
  const [method, salt, expectedHex] = storedHash.split("$");
  const [, n, r, p] = method.split(":");
  if (!method || !salt || !expectedHex) return false;
  const actualHex = scryptSync(password, salt, Buffer.from(expectedHex, "hex").length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 128 * 1024 * 1024,
  }).toString("hex");
  return safeCompareHex(actualHex, expectedHex);
}

function verifyPbkdf2(password: string, storedHash: string) {
  const [method, salt, expectedHex] = storedHash.split("$");
  const [, algorithm, iterations] = method.split(":");
  if (!algorithm || !iterations || !salt || !expectedHex) return false;
  const actualHex = pbkdf2Sync(
    password,
    salt,
    Number(iterations),
    Buffer.from(expectedHex, "hex").length,
    algorithm,
  ).toString("hex");
  return safeCompareHex(actualHex, expectedHex);
}

export function verifyPassword(password: string, storedHash: string) {
  try {
    if (storedHash.startsWith("scrypt:")) return verifyScrypt(password, storedHash);
    if (storedHash.startsWith("pbkdf2:")) return verifyPbkdf2(password, storedHash);
  } catch {
    return false;
  }
  return false;
}
