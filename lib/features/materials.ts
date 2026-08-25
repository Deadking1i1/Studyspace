import path from "node:path";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { studyMaterials } from "@/db/schema";
import { verifyCsrfToken } from "@/lib/auth/csrf";
import { currentUser } from "@/lib/auth/session";
import { invalidateAcademicAutopilotCache, ownedAcademicSelection } from "@/lib/features/academic";
import { sanitizePlain } from "@/lib/text";
import { deletePrivateObject, putPrivateObject } from "@/lib/storage";
import { scanUpload } from "@/lib/upload-scanner";

export const materialsUploadDir = path.join(process.cwd(), "storage", "study-materials");
export const maxMaterialSizeBytes = 25 * 1024 * 1024;
export const materialStorageQuotaBytes = 250 * 1024 * 1024;

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
const mimeAliases = new Map<string, Set<string>>([
  [".pdf", new Set(["application/pdf"])],
  [".txt", new Set(["text/plain"])],
  [".md", new Set(["text/markdown", "text/plain"])],
  [".csv", new Set(["text/csv", "text/plain", "application/vnd.ms-excel"])],
  [".png", new Set(["image/png"])],
  [".jpg", new Set(["image/jpeg"])],
  [".jpeg", new Set(["image/jpeg"])],
  [".webp", new Set(["image/webp"])],
  [".docx", new Set(["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/octet-stream"])],
  [".pptx", new Set(["application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/octet-stream"])],
  [".xlsx", new Set(["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"])],
]);

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
  if (file.type && !mimeAliases.get(extension)?.has(file.type.toLowerCase())) {
    return { ok: false as const, error: "The file's reported type does not match its extension." };
  }
  if (file.size <= 0) return { ok: false as const, error: "The selected file is empty." };
  if (file.size > maxMaterialSizeBytes) return { ok: false as const, error: "Study materials must be 25 MB or smaller." };
  return { ok: true as const, originalName, extension, mimeType: expectedMime };
}

function zipEntryNames(bytes: Uint8Array) {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minimumEocdOffset = Math.max(0, buffer.length - 65_557);
  let eocdOffset = -1;
  for (let offset = buffer.length - 22; offset >= minimumEocdOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) return null;
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  let offset = buffer.readUInt32LE(eocdOffset + 16);
  const names = new Set<string>();
  for (let entry = 0; entry < entryCount; entry += 1) {
    if (offset + 46 > eocdOffset || buffer.readUInt32LE(offset) !== 0x02014b50) return null;
    const filenameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const nextOffset = offset + 46 + filenameLength + extraLength + commentLength;
    if (nextOffset > eocdOffset) return null;
    names.add(buffer.toString("utf8", offset + 46, offset + 46 + filenameLength));
    offset = nextOffset;
  }
  return offset <= eocdOffset ? names : null;
}

export function validateStudyMaterialBytes(bytes: Uint8Array, extension: string) {
  if (extension === ".pdf") {
    const tail = Buffer.from(bytes.slice(Math.max(0, bytes.length - 1024))).toString("latin1");
    return bytes.length >= 8 && Buffer.from(bytes.slice(0, 5)).toString("ascii") === "%PDF-" && tail.includes("%%EOF");
  }
  if (extension === ".png") {
    return bytes.length >= 33
      && Buffer.from(bytes.slice(0, 8)).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      && Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).readUInt32BE(8) === 13
      && Buffer.from(bytes.slice(12, 16)).toString("ascii") === "IHDR";
  }
  if (extension === ".jpg" || extension === ".jpeg") {
    return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
  }
  if (extension === ".webp") {
    if (bytes.length < 20 || Buffer.from(bytes.slice(0, 4)).toString("ascii") !== "RIFF" || Buffer.from(bytes.slice(8, 12)).toString("ascii") !== "WEBP") return false;
    const declaredSize = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).readUInt32LE(4) + 8;
    const chunkType = Buffer.from(bytes.slice(12, 16)).toString("ascii");
    return declaredSize === bytes.length && new Set(["VP8 ", "VP8L", "VP8X"]).has(chunkType);
  }
  if (officeExtensions.has(extension)) {
    if (bytes.length < 22 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return false;
    const entries = zipEntryNames(bytes);
    if (!entries) return false;
    const requiredPart = extension === ".docx" ? "word/document.xml" : extension === ".pptx" ? "ppt/presentation.xml" : "xl/workbook.xml";
    return entries.has("[Content_Types].xml") && entries.has(requiredPart);
  }
  if (textExtensions.has(extension)) {
    if (bytes.includes(0)) return false;
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function studyMaterialStorageKey(material: { storagePath: string; storedFilename: string }) {
  if (/^study-materials\/[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/.test(material.storagePath)) return material.storagePath;
  if (/^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/.test(material.storedFilename)) return `study-materials/${material.storedFilename}`;
  throw new Error("Invalid study material storage reference.");
}

export async function uploadStudyMaterial(formData: FormData) {
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
  try {
    await scanUpload(bytes, validation.originalName, validation.mimeType);
  } catch {
    redirectWith("The file could not be verified as safe.", "error");
  }

  const title = sanitizePlain(formData.get("title")).slice(0, 255) || validation.originalName;
  const subject = sanitizePlain(formData.get("subject")).slice(0, 128) || null;
  const academic = await ownedAcademicSelection(user.id, formData.get("subject_id"), formData.get("topic_id"));
  const storedFilename = `${user.id}-${randomUUID()}${validation.extension}`;
  const storagePath = `study-materials/${storedFilename}`;
  const [usage] = await db.select({ bytes: sql<number>`coalesce(sum(${studyMaterials.fileSizeBytes}), 0)` }).from(studyMaterials).where(eq(studyMaterials.userId, user.id));
  if (Number(usage?.bytes ?? 0) + file.size > materialStorageQuotaBytes) redirectWith("Your private-beta material storage quota is full.", "error");

  await putPrivateObject(storagePath, bytes, validation.mimeType);
  try {
    await db.insert(studyMaterials).values({
      userId: user.id,
      subjectId: academic.subjectId,
      topicId: academic.topicId,
      title,
      subject: academic.subjectName ?? subject,
      originalFilename: validation.originalName,
      storedFilename,
      storagePath,
      mimeType: validation.mimeType,
      fileSizeBytes: file.size,
      createdAt: new Date(),
    });
  } catch (error) {
    await deletePrivateObject(storagePath).catch(() => undefined);
    throw error;
  }

  invalidateAcademicAutopilotCache(user.id);
  revalidatePath("/materials");
  revalidatePath("/autopilot");
  revalidatePath("/");
  redirectWith("Study material uploaded.");
}

export async function uploadStudyMaterialAction(formData: FormData) {
  "use server";
  return uploadStudyMaterial(formData);
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
  if (!Number.isSafeInteger(materialId) || materialId <= 0) redirectWith("Study material not found.", "error");
  const [material] = await db.select().from(studyMaterials).where(and(eq(studyMaterials.id, materialId), eq(studyMaterials.userId, user.id))).limit(1);
  if (!material) redirectWith("Study material not found.", "error");

  await deletePrivateObject(studyMaterialStorageKey(material));
  await db.delete(studyMaterials).where(eq(studyMaterials.id, material.id));
  invalidateAcademicAutopilotCache(user.id);
  revalidatePath("/materials");
  revalidatePath("/autopilot");
  revalidatePath("/");
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
