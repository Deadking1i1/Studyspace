import { headers } from "next/headers";
import { clientIp } from "./request-context";

export async function requestIdentifier(extra = "") {
  const requestHeaders = await headers();
  const ip = clientIp(requestHeaders) || "direct";
  return `${ip}:${extra}`;
}
