import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { studyMaterials } from "@/db/schema";
import { verifyCsrfToken } from "@/lib/auth/csrf";
import { currentUser } from "@/lib/auth/session";
import { sanitizePlain } from "@/lib/text";

export const materialsUploadDir = path.join(process.cwd(), "storage", "study-materials");
export const maxMaterialSizeBytes = 25 * 1024 * 1024;

const allowedExtensions = new Map([
  [".pdf", "application/pdf"],
  [".txt", "text/plain"],
  [".md", "text/markdown"],
  [".csv", "text/csv"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  [".pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  [".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
]);

const officeExtensions = new Set([".docx", ".pptx", ".xlsx"]);
const textExtensions = new Set([".txt", ".md", ".csv"]);

function redirectWith(message: string, type: "error" | "success" = "success"): never {
  redirect(`/materials?${type}=${encodeURIComponent(message)}`);
}

export function sanitizeFilename(filename: string) {
  const basename = path.basename(filename).replace(/[^\w .()-]/g, "_").trim();
  return basename || "study-material";
}

export function validateStudyMaterialFile(file: File) {
  const originalName = sanitizeFilename(file.name);
  const extension = path.extname(originalName).toLowerCase();
  const expectedMime = allowedExtensions.get(extension);
  if (!expectedMime) return { ok: false as const, error: "Unsupported file type. Upload PDF, text, image, Word, PowerPoint or Excel study files." };
  if (file.size <= 0) return { ok: false as const, error: "The selected file is empty." };
  if (file.size > maxMaterialSizeBytes) return { ok: false as const, error: "Study materials must be 25 MB or smaller." };
  return { ok: true as const, originalName, extension, mimeType: expectedMime };
}

export function validateStudyMaterialBytes(bytes: Uint8Array, extension: string) {
  if (extension === ".pdf") return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  if (extension === ".png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (extension === ".jpg" || extension === ".jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (extension === ".webp") return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if (officeExtensions.has(extension)) return bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (textExtensions.has(extension)) return !bytes.slice(0, 2048).includes(0);
  return false;
}

export async function uploadStudyMaterialAction(formData: FormData) {
  "use server";
  try {
    await verifyCsrfToken(formData);
  } catch {
    redirectWith("Security check failed. Please try again.", "error");
  }

  const user = await currentUser();
  if (!user) redirect("/login");

  const file = formData.get("material");
  if (!(file instanceof File)) redirectWith("Choose a study material to upload.", "error");

  const validation = validateStudyMaterialFile(file);
  if (!validation.ok) redirectWith(validation.error, "error");

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!validateStudyMaterialBytes(bytes, validation.extension)) {
    redirectWith("The file content does not match the selected file type.", "error");
  }

  const title = sanitizePlain(formData.get("title")).slice(0, 255) || validation.originalName;
  const subject = sanitizePlain(formData.get("subject")).slice(0, 128) || null;
  const storedFilename = `${user.id}-${randomUUID()}${validation.extension}`;
  const storagePath = path.join(materialsUploadDir, storedFilename);

  await mkdir(materialsUploadDir, { recursive: true });
  await writeFile(storagePath, bytes, { flag: "wx" });

  await db.insert(studyMaterials).values({
    userId: user.id,
    title,
    subject,
    originalFilename: validation.originalName,
    storedFilename,
    storagePath,
    mimeType: validation.mimeType,
    fileSizeBytes: file.size,
    createdAt: new Date(),
  });

  revalidatePath("/materials");
  redirectWith("Study material uploaded.");
}

export async function deleteStudyMaterialAction(formData: FormData) {
  "use server";
  try {
    await verifyCsrfToken(formData);
  } catch {
    redirectWith("Security check failed. Please try again.", "error");
  }

  const user = await currentUser();
  if (!user) redirect("/login");
  const materialId = Number(formData.get("material_id"));
  const [material] = await db.select().from(studyMaterials).where(and(eq(studyMaterials.id, materialId), eq(studyMaterials.userId, user.id))).limit(1);
  if (!material) redirectWith("Study material not found.", "error");

  await db.delete(studyMaterials).where(eq(studyMaterials.id, material.id));
  await unlink(material.storagePath).catch(() => undefined);
  revalidatePath("/materials");
  redirectWith("Study material deleted.");
}

export function materialSearchPredicate(userId: number, query: string) {
  const base = [eq(studyMaterials.userId, userId)];
  if (!query) return and(...base);
  const search = `%${query}%`;
  return and(
    ...base,
    or(ilike(studyMaterials.title, search), ilike(studyMaterials.subject, search), ilike(studyMaterials.originalFilename, search)),
  );
}

export function materialOrder() {
  return [desc(studyMaterials.createdAt)] as const;
}
