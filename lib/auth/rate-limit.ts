import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { authRateLimits } from "@/db/schema";

type RateLimitOptions = {
  action: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
};

export class RateLimitError extends Error {
  retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Too many requests.");
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function hashIdentifier(identifier: string) {
  return createHash("sha256").update(identifier || "anonymous", "utf8").digest("hex");
}

function windowStartFor(now: Date, windowSeconds: number) {
  return new Date(Math.floor(now.getTime() / (windowSeconds * 1000)) * windowSeconds * 1000);
}

export function parseRateLimit(value: string, fallbackLimit: number, fallbackWindowSeconds: number) {
  const match = /^(\d+)\s+per\s+(\d+\s+)?(second|minute|hour)$/i.exec(value.trim());
  if (!match) return { limit: fallbackLimit, windowSeconds: fallbackWindowSeconds };
  const count = Number(match[1]);
  const amount = Number((match[2] || "1").trim());
  const unit = match[3].toLowerCase();
  const seconds = unit === "hour" ? 3600 : unit === "minute" ? 60 : 1;
  return { limit: count, windowSeconds: amount * seconds };
}

export async function enforceRateLimit({ action, identifier, limit, windowSeconds }: RateLimitOptions) {
  const now = new Date();
  const windowStart = windowStartFor(now, windowSeconds);
  const identifierHash = hashIdentifier(identifier);
  const [row] = await db
    .select()
    .from(authRateLimits)
    .where(
      and(
        eq(authRateLimits.action, action),
        eq(authRateLimits.identifierHash, identifierHash),
        eq(authRateLimits.windowStart, windowStart),
      ),
    )
    .limit(1);

  if (!row) {
    await db.insert(authRateLimits).values({ action, identifierHash, windowStart, count: 1, updatedAt: now });
    return;
  }

  if (row.count >= limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((windowStart.getTime() + windowSeconds * 1000 - now.getTime()) / 1000),
    );
    throw new RateLimitError(retryAfterSeconds);
  }

  await db
    .update(authRateLimits)
    .set({ count: row.count + 1, updatedAt: now })
    .where(eq(authRateLimits.id, row.id));
}
