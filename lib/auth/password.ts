import { randomBytes, scryptSync, pbkdf2Sync, timingSafeEqual } from "node:crypto";

const MAX_PASSWORD_LENGTH = 1024;
const MAX_DERIVED_KEY_BYTES = 128;
const MAX_PBKDF2_ITERATIONS = 2_000_000;

export function passwordStrengthErrors(password: string) {
  const errors: string[] = [];
  if ((password || "").length < 8) errors.push("Password must be at least 8 characters long.");
  if ((password || "").length > MAX_PASSWORD_LENGTH) errors.push("Password is too long.");
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
  const cost = Number(n);
  const blockSize = Number(r);
  const parallelization = Number(p);
  const derivedKeyLength = Buffer.from(expectedHex, "hex").length;
  if (
    !method || !salt || !expectedHex ||
    !Number.isSafeInteger(cost) || cost < 2 || cost > 131072 || (cost & (cost - 1)) !== 0 ||
    !Number.isSafeInteger(blockSize) || blockSize < 1 || blockSize > 32 ||
    !Number.isSafeInteger(parallelization) || parallelization < 1 || parallelization > 16 ||
    derivedKeyLength < 16 || derivedKeyLength > MAX_DERIVED_KEY_BYTES
  ) return false;
  const actualHex = scryptSync(password, salt, derivedKeyLength, {
    N: cost,
    r: blockSize,
    p: parallelization,
    maxmem: 128 * 1024 * 1024,
  }).toString("hex");
  return safeCompareHex(actualHex, expectedHex);
}

function verifyPbkdf2(password: string, storedHash: string) {
  const [method, salt, expectedHex] = storedHash.split("$");
  const [, algorithm, iterations] = method.split(":");
  const iterationCount = Number(iterations);
  const derivedKeyLength = Buffer.from(expectedHex, "hex").length;
  if (
    !algorithm || !iterations || !salt || !expectedHex ||
    !["sha256", "sha512"].includes(algorithm.toLowerCase()) ||
    !Number.isSafeInteger(iterationCount) || iterationCount < 1 || iterationCount > MAX_PBKDF2_ITERATIONS ||
    derivedKeyLength < 16 || derivedKeyLength > MAX_DERIVED_KEY_BYTES
  ) return false;
  const actualHex = pbkdf2Sync(
    password,
    salt,
    iterationCount,
    derivedKeyLength,
    algorithm,
  ).toString("hex");
  return safeCompareHex(actualHex, expectedHex);
}

export function verifyPassword(password: string, storedHash: string) {
  if (!password || password.length > MAX_PASSWORD_LENGTH || !storedHash) return false;
  try {
    if (storedHash.startsWith("scrypt:")) return verifyScrypt(password, storedHash);
    if (storedHash.startsWith("pbkdf2:")) return verifyPbkdf2(password, storedHash);
  } catch {
    return false;
  }
  return false;
}
