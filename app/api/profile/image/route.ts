import path from "node:path";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { currentUser } from "@/lib/auth/session";
import { getPrivateObject, storageErrorIsNotFound } from "@/lib/storage";

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
  if (!filename || (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/.test(filename) && !/^profile-images\/[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/.test(filename))) {
    return new NextResponse(null, { status: 404 });
  }
  try {
    const storageKey = filename.startsWith("profile-images/") ? filename : `profile-images/${filename}`;
    const image = await getPrivateObject(storageKey);
    return new NextResponse(image, {
      headers: {
        "cache-control": "private, no-store",
        "content-type": contentTypes[path.extname(filename).toLowerCase()] ?? "application/octet-stream",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    if (storageErrorIsNotFound(error)) return new NextResponse(null, { status: 404 });
    return NextResponse.json(
      { error: "Profile image storage is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "5" } },
    );
  }
}
