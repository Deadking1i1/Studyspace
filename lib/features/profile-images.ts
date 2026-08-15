import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { userProfiles, users } from "@/db/schema";
import { verifyCsrfToken } from "@/lib/auth/csrf";
import { logSecurityEvent } from "@/lib/auth/security-events";
import { currentUser } from "@/lib/auth/session";

export const profileImageDir = path.join(process.cwd(), "storage", "profile-images");
export const maxProfileImageBytes = 5 * 1024 * 1024;

const imageTypes = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
]);

function redirectWith(message: string, type: "error" | "success" = "success"): never {
  redirect(`/settings?${type}=${encodeURIComponent(message)}`);
}

export function validateProfileImageFile(file: File) {
  const extension = path.extname(path.basename(file.name)).toLowerCase();
  const mimeType = imageTypes.get(extension);
  if (!mimeType) return { ok: false as const, error: "Choose a PNG, JPEG or WebP profile image." };
  if (file.size <= 0) return { ok: false as const, error: "The selected image is empty." };
  if (file.size > maxProfileImageBytes) return { ok: false as const, error: "Profile images must be 5 MB or smaller." };
  return { ok: true as const, extension, mimeType };
}

export function validateProfileImageBytes(bytes: Uint8Array, extension: string) {
  if (extension === ".png") {
    return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }
  if (extension === ".jpg" || extension === ".jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (extension === ".webp") {
    return bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
      && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  }
  return false;
}

export async function uploadProfileImageAction(formData: FormData) {
  "use server";
  try {
    await verifyCsrfToken(formData);
  } catch {
    redirectWith("Security check failed. Please try again.", "error");
  }

  const user = await currentUser();
  if (!user) redirect("/login");
  const file = formData.get("profile_image");
  if (!(file instanceof File)) redirectWith("Choose a profile image to upload.", "error");
  const validation = validateProfileImageFile(file);
  if (!validation.ok) redirectWith(validation.error, "error");

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!validateProfileImageBytes(bytes, validation.extension)) {
    await logSecurityEvent(user.id, "profile.image_rejected", { reason: "signature_mismatch" });
    redirectWith("The image content does not match its file type.", "error");
  }

  const storedFilename = `${user.id}-${randomUUID()}${validation.extension}`;
  await mkdir(profileImageDir, { recursive: true });
  await writeFile(path.join(profileImageDir, storedFilename), bytes, { flag: "wx" });

  const [existing] = await db.select({ profilePic: userProfiles.profilePic }).from(userProfiles).where(eq(userProfiles.userId, user.id)).limit(1);
  await db.update(userProfiles).set({ profilePic: storedFilename, updatedAt: new Date() }).where(eq(userProfiles.userId, user.id));
  await db.update(users).set({ profilePic: storedFilename }).where(eq(users.id, user.id));
  if (existing?.profilePic && /^[\w.-]+$/.test(existing.profilePic)) {
    await unlink(path.join(profileImageDir, existing.profilePic)).catch(() => undefined);
  }
  await logSecurityEvent(user.id, "profile.image_updated", {});
  revalidatePath("/profile");
  revalidatePath("/settings");
  redirectWith("Profile image updated.");
}
