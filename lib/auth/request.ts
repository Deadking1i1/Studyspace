import { headers } from "next/headers";

export async function requestIdentifier(extra = "") {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  const ip = (forwardedFor?.split(",", 1)[0] || requestHeaders.get("x-real-ip") || "anonymous").trim();
  return `${ip}:${extra}`;
}
