import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { verifyCsrfToken } from "@/lib/auth/csrf";

export async function POST(request: Request) {
  try {
    await verifyCsrfToken(await request.formData());
  } catch {
    return NextResponse.json({ error: "Invalid CSRF token." }, { status: 403 });
  }
  await destroySession();
  return NextResponse.redirect(new URL("/login?success=You%20have%20been%20signed%20out.", env.STUDY_SPACE_APP_BASE_URL));
}

export async function GET() {
  return NextResponse.json({ error: "Logout requires POST." }, { status: 405 });
}
