import { env } from "@/lib/env";

export function clientIp(requestHeaders: Headers) {
  if (!env.TRUST_PROXY_HEADERS) return null;
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  const candidate = forwarded || requestHeaders.get("x-real-ip")?.trim() || "";
  return candidate.slice(0, 64) || null;
}
