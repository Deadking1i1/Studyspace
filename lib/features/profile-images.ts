import { randomUUID } from "node:crypto";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { verifyCsrfToken } from "@/lib/auth/csrf";
import { logSecurityEvent } from "@/lib/auth/security-events";
import { currentUser } from "@/lib/auth/session";
import { deletePrivateObject, putPrivateObject } from "@/lib/storage";
import { scanUpload } from "@/lib/upload-scanner";

export const profileImageDir = path.join(process.cwd(), "storage", "profile-images");
export const maxProfileImageBytes = 5 * 1024 * 1024;

const imageTypes = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
]);
const maxProfileImageDimension = 8192;
const maxProfileImagePixels = 40_000_000;

function redirectWith(message: string, type: "error" | "success" = "success"): never {
  redirect(`/settings?${type}=${encodeURIComponent(message)}`);
}

export function validateProfileImageFile(file: File) {
  const extension = path.extname(path.basename(file.name)).toLowerCase();
  const mimeType = imageTypes.get(extension);
  if (!mimeType) return { ok: false as const, error: "Choose a PNG, JPEG or WebP profile image." };
  if (file.type && file.type.toLowerCase() !== mimeType) {
    return { ok: false as const, error: "The image's reported type does not match its extension." };
  }
  if (file.size <= 0) return { ok: false as const, error: "The selected image is empty." };
  if (file.size > maxProfileImageBytes) return { ok: false as const, error: "Profile images must be 5 MB or smaller." };
  return { ok: true as const, extension, mimeType };
}

function validImageDimensions(width: number, height: number) {
  return Number.isInteger(width) && Number.isInteger(height)
    && width > 0 && height > 0
    && width <= maxProfileImageDimension && height <= maxProfileImageDimension
    && width * height <= maxProfileImagePixels;
}

function jpegDimensions(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) return null;
  const startOfFrameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 3 < bytes.length) {
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === undefined || marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 1 >= bytes.length) return null;
    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
    if (startOfFrameMarkers.has(marker) && segmentLength >= 7) {
      return {
        height: (bytes[offset + 3] << 8) | bytes[offset + 4],
        width: (bytes[offset + 5] << 8) | bytes[offset + 6],
      };
    }
    offset += segmentLength;
  }
  return null;
}

function webpDimensions(bytes: Uint8Array) {
  if (bytes.length < 20 || Buffer.from(bytes.slice(0, 4)).toString("ascii") !== "RIFF" || Buffer.from(bytes.slice(8, 12)).toString("ascii") !== "WEBP") return null;
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (buffer.readUInt32LE(4) + 8 !== bytes.length) return null;
  const chunk = buffer.toString("ascii", 12, 16);
  const chunkSize = buffer.readUInt32LE(16);
  if (20 + chunkSize + (chunkSize % 2) > bytes.length) return null;
  if (chunk === "VP8X" && chunkSize >= 10) {
    return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
  }
  if (chunk === "VP8L" && chunkSize >= 5 && bytes[20] === 0x2f) {
    const bits = buffer.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) };
  }
  if (chunk === "VP8 " && chunkSize >= 10 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  }
  return null;
}

export function validateProfileImageBytes(bytes: Uint8Array, extension: string) {
  if (extension === ".png") {
    if (bytes.length < 33 || !Buffer.from(bytes.slice(0, 8)).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return false;
    const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (buffer.readUInt32BE(8) !== 13 || buffer.toString("ascii", 12, 16) !== "IHDR") return false;
    return validImageDimensions(buffer.readUInt32BE(16), buffer.readUInt32BE(20));
  }
  if (extension === ".jpg" || extension === ".jpeg") {
    const dimensions = jpegDimensions(bytes);
    return Boolean(dimensions && validImageDimensions(dimensions.width, dimensions.height));
  }
  if (extension === ".webp") {
    const dimensions = webpDimensions(bytes);
    return Boolean(dimensions && validImageDimensions(dimensions.width, dimensions.height));
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
  try {
    await scanUpload(bytes, file.name, validation.mimeType);
  } catch {
    await logSecurityEvent(user.id, "profile.image_rejected", { reason: "scanner" });
    redirectWith("The image could not be verified as safe.", "error");
  }

  const storedFilename = `${user.id}-${randomUUID()}${validation.extension}`;
  const storageKey = `profile-images/${storedFilename}`;
  const [existing] = await db.select({ profilePic: userProfiles.profilePic }).from(userProfiles).where(eq(userProfiles.userId, user.id)).limit(1);
  await putPrivateObject(storageKey, bytes, validation.mimeType);
  try {
    await db.execute(sql`
      with saved_profile as (
        insert into user_profiles (user_id, profile_pic, created_at, updated_at)
        values (${user.id}, ${storageKey}, now(), now())
        on conflict (user_id) do update
        set profile_pic = excluded.profile_pic, updated_at = now()
        returning user_id
      )
      update users
      set profile_pic = ${storageKey}
      where id = ${user.id} and exists (select 1 from saved_profile)
    `);
  } catch (error) {
    await deletePrivateObject(storageKey).catch(() => undefined);
    throw error;
  }
  if (existing?.profilePic && /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/.test(existing.profilePic)) {
    await deletePrivateObject(`profile-images/${existing.profilePic}`).catch(() => logSecurityEvent(user.id, "profile.image_cleanup_failed", {}).catch(() => undefined));
  } else if (existing?.profilePic?.startsWith("profile-images/")) {
    await deletePrivateObject(existing.profilePic).catch(() => logSecurityEvent(user.id, "profile.image_cleanup_failed", {}).catch(() => undefined));
  }
  await logSecurityEvent(user.id, "profile.image_updated", {});
  revalidatePath("/profile");
  revalidatePath("/settings");
  redirectWith("Profile image updated.");
}
