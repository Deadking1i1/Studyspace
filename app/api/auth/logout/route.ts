import { NextResponse } from "next/server";
import { currentUser, destroySession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { verifyCsrfToken } from "@/lib/auth/csrf";
import { logSecurityEvent } from "@/lib/auth/security-events";

export async function POST(request: Request) {
  try {
    await verifyCsrfToken(await request.formData());
  } catch {
    return NextResponse.json({ error: "Invalid CSRF token." }, { status: 403 });
  }
  const user = await currentUser();
  if (user) await logSecurityEvent(user.id, "auth.logout", {});
  await destroySession();
  return NextResponse.redirect(
    new URL("/login?success=You%20have%20been%20signed%20out.", env.STUDY_SPACE_APP_BASE_URL),
    303,
  );
}

export async function GET() {
  return NextResponse.json({ error: "Logout requires POST." }, { status: 405 });
}
