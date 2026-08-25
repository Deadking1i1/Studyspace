import { cookies } from "next/headers";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { userSessions, users } from "@/db/schema";
import { addHours, createToken, hashToken } from "./tokens";
import { headers } from "next/headers";
import { SESSION_COOKIE } from "./constants";
import { clientIp } from "./request-context";

export { SESSION_COOKIE };

export async function createSession(userId: number) {
  const token = createToken();
  const expiresAt = addHours(new Date(), 24 * 7);
  const requestHeaders = await headers();
  const ipAddress = clientIp(requestHeaders);
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
    priority: "high",
    expires: expiresAt,
    path: "/",
  });
}

export async function revokeAllUserSessions(userId: number) {
  await db.update(userSessions).set({ revokedAt: new Date() }).where(eq(userSessions.userId, userId));
}

export async function activeSessionsForUser(userId: number) {
  const cookieStore = await cookies();
  const currentHash = cookieStore.get(SESSION_COOKIE)?.value ? hashToken(cookieStore.get(SESSION_COOKIE)!.value) : null;
  const rows = await db.select({ id: userSessions.id, tokenHash: userSessions.tokenHash, ipAddress: userSessions.ipAddress, userAgent: userSessions.userAgent, createdAt: userSessions.createdAt, expiresAt: userSessions.expiresAt })
    .from(userSessions)
    .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt), gt(userSessions.expiresAt, new Date())))
    .orderBy(desc(userSessions.createdAt));
  return rows.map(({ tokenHash, ...session }) => ({ ...session, current: tokenHash === currentHash }));
}

export async function revokeOwnedSession(userId: number, sessionId: number) {
  const rows = await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(userSessions.id, sessionId), eq(userSessions.userId, userId), isNull(userSessions.revokedAt)))
    .returning();
  return rows.length === 1;
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
