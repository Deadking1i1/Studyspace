import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { userSettings } from "@/db/schema";
import { ensureAccountRecords } from "@/lib/account";
import { verifyCsrfHeader } from "@/lib/auth/csrf";
import { logSecurityEvent } from "@/lib/auth/security-events";
import { currentUser } from "@/lib/auth/session";
import { normalizeTheme } from "@/lib/themes";

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  try {
    await verifyCsrfHeader(request.headers.get("x-csrf-token"));
  } catch {
    return NextResponse.json({ error: "Security check failed. Refresh and try again." }, { status: 403 });
  }

  let body: { theme?: unknown };
  try {
    body = (await request.json()) as { theme?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const requestedTheme = typeof body.theme === "string" ? body.theme : "";
  const theme = normalizeTheme(requestedTheme);
  if (requestedTheme !== theme) return NextResponse.json({ error: "Theme unavailable." }, { status: 400 });

  await ensureAccountRecords(user);
  await db.update(userSettings).set({ theme, updatedAt: new Date() }).where(eq(userSettings.userId, user.id));
  await logSecurityEvent(user.id, "settings.theme_updated", { theme });
  return NextResponse.json({ theme });
}
