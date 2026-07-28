import { cookies } from "next/headers";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { userSessions, users } from "@/db/schema";
import { addHours, createToken, hashToken } from "./tokens";
import { headers } from "next/headers";
import { SESSION_COOKIE } from "./constants";

export { SESSION_COOKIE };

export async function createSession(userId: number) {
  const token = createToken();
  const expiresAt = addHours(new Date(), 24 * 7);
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  const ipAddress = (forwardedFor?.split(",", 1)[0] || requestHeaders.get("x-real-ip") || "").slice(0, 64) || null;
  const userAgent = (requestHeaders.get("user-agent") || "").slice(0, 255) || null;
  await db.insert(userSessions).values({
    userId,
    tokenHash: hashToken(token),
    ipAddress,
    userAgent,
    createdAt: new Date(),
    expiresAt,
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await db
      .update(userSessions)
      .set({ revokedAt: new Date() })
      .where(eq(userSessions.tokenHash, hashToken(token)));
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function currentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({ user: users })
    .from(userSessions)
    .innerJoin(users, eq(users.id, userSessions.userId))
    .where(
      and(
        eq(userSessions.tokenHash, hashToken(token)),
        isNull(userSessions.revokedAt),
        gt(userSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return rows[0]?.user ?? null;
}
