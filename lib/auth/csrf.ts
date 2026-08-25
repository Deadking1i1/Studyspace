import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { CSRF_COOKIE } from "./constants";

export { CSRF_COOKIE };

export async function getCsrfToken() {
  const cookieStore = await cookies();
  const existing = cookieStore.get(CSRF_COOKIE)?.value;
  return existing ?? "";
}

export async function verifyCsrfToken(formData: FormData) {
  const submitted = String(formData.get("csrf_token") || "");
  const cookieStore = await cookies();
  const cookie = cookieStore.get(CSRF_COOKIE)?.value || "";
  if (!safeEqual(submitted, cookie)) {
    throw new Error("Invalid CSRF token.");
  }
}

export async function verifyCsrfHeader(submitted: string | null) {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(CSRF_COOKIE)?.value || "";
  if (!safeEqual(submitted || "", cookie)) {
    throw new Error("Invalid CSRF token.");
  }
}

function safeEqual(left: string, right: string) {
  if (!left || !right) return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
