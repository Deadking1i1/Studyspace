import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { currentUser } from "@/lib/auth/session";
import { profileImageDir } from "@/lib/features/profile-images";

const contentTypes: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const [profile] = await db.select({ profilePic: userProfiles.profilePic }).from(userProfiles).where(eq(userProfiles.userId, user.id)).limit(1);
  const filename = profile?.profilePic;
  if (!filename || !/^[\w.-]+$/.test(filename)) return new NextResponse(null, { status: 404 });
  try {
    const image = await readFile(path.join(profileImageDir, filename));
    return new NextResponse(image, {
      headers: {
        "cache-control": "private, max-age=3600",
        "content-type": contentTypes[path.extname(filename).toLowerCase()] ?? "application/octet-stream",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
