import { cookies } from "next/headers";
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
  if (!submitted || !cookie || submitted !== cookie) {
    throw new Error("Invalid CSRF token.");
  }
}

export async function verifyCsrfHeader(submitted: string | null) {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(CSRF_COOKIE)?.value || "";
  if (!submitted || !cookie || submitted !== cookie) {
    throw new Error("Invalid CSRF token.");
  }
}
