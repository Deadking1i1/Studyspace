import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { exportUserData } from "@/lib/account";
import { logSecurityEvent } from "@/lib/auth/security-events";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const payload = await exportUserData(user.id);
  await logSecurityEvent(user.id, "account_exported", {});
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-disposition": `attachment; filename="study-space-account-${user.id}.json"`,
      "content-type": "application/json; charset=utf-8",
    },
  });
}
