import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { exportUserData } from "@/lib/account";
import { logSecurityEvent } from "@/lib/auth/security-events";
import { verifyCsrfToken } from "@/lib/auth/csrf";
import { verifyPassword } from "@/lib/auth/password";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const formData = await request.formData();
  try {
    await verifyCsrfToken(formData);
  } catch {
    return NextResponse.json({ error: "Security check failed." }, { status: 403 });
  }
  if (!verifyPassword(String(formData.get("password") || ""), user.passwordHash)) {
    await logSecurityEvent(user.id, "account_export_failed", { reason: "password" });
    return NextResponse.json({ error: "Password confirmation failed." }, { status: 403 });
  }
  const payload = await exportUserData(user.id);
  await logSecurityEvent(user.id, "account_exported", {});
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "cache-control": "private, no-store, max-age=0",
      "content-disposition": `attachment; filename="study-space-account-${user.id}.json"`,
      "content-type": "application/json; charset=utf-8",
      "pragma": "no-cache",
      "x-content-type-options": "nosniff",
    },
  });
}

export function GET() {
  return NextResponse.json({ error: "Use the password-confirmed export form in Settings." }, { status: 405, headers: { Allow: "POST" } });
}
