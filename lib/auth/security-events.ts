import { headers } from "next/headers";
import { db } from "@/db";
import { securityEvents } from "@/db/schema";

export async function logSecurityEvent(userId: number | null, eventType: string, metadata?: Record<string, unknown>) {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  const ipAddress = (forwardedFor?.split(",", 1)[0] || requestHeaders.get("x-real-ip") || "").slice(0, 64) || null;
  const userAgent = (requestHeaders.get("user-agent") || "").slice(0, 255) || null;
  await db.insert(securityEvents).values({
    userId,
    eventType: eventType.slice(0, 64),
    ipAddress,
    userAgent,
    metadataJson: JSON.stringify(metadata ?? {}),
    createdAt: new Date(),
  });
}
