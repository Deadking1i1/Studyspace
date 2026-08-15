import { and, desc, eq, ilike, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { notes } from "@/db/schema";
import { currentUser } from "@/lib/auth/session";
import { verifyCsrfToken } from "@/lib/auth/csrf";
import { invalidateAcademicAutopilotCache, ownedAcademicSelection } from "@/lib/features/academic";
import { sanitizePlain } from "@/lib/text";

function redirectWith(message: string, type: "error" | "success" = "success"): never {
  redirect(`/notes?${type}=${encodeURIComponent(message)}`);
}

export async function createNoteAction(formData: FormData) {
  "use server";
  try {
    await verifyCsrfToken(formData);
  } catch {
    redirectWith("Security check failed. Please try again.", "error");
  }
  const user = await currentUser();
  if (!user) redirect("/login");
  const title = sanitizePlain(formData.get("title")).slice(0, 255);
  const content = sanitizePlain(formData.get("content"));
  const subject = sanitizePlain(formData.get("subject")).slice(0, 128) || null;
  const tags = sanitizePlain(formData.get("tags")).slice(0, 255) || null;
  const academic = await ownedAcademicSelection(user.id, formData.get("subject_id"), formData.get("topic_id"));
  if (!title || !content) redirectWith("Title and content are required.", "error");

  const now = new Date();
  await db.insert(notes).values({
    userId: user.id,
    subjectId: academic.subjectId,
    topicId: academic.topicId,
    title,
    content,
    subject: academic.subjectName ?? subject,
    tags,
    isPublic: formData.get("visibility") === "public",
    createdAt: now,
    updatedAt: now,
  });
  invalidateAcademicAutopilotCache(user.id);
  revalidatePath("/notes");
  revalidatePath("/autopilot");
  revalidatePath("/");
  redirectWith("Note created successfully.");
}

export async function updateNoteStateAction(formData: FormData) {
  "use server";
  try {
    await verifyCsrfToken(formData);
  } catch {
    redirectWith("Security check failed. Please try again.", "error");
  }
  const user = await currentUser();
  if (!user) redirect("/login");
  const noteId = Number(formData.get("note_id"));
  const action = sanitizePlain(formData.get("action"));
  const [note] = await db.select().from(notes).where(and(eq(notes.id, noteId), eq(notes.userId, user.id))).limit(1);
  if (!note) redirectWith("Note not found.", "error");

  if (action === "delete") {
    await db.delete(notes).where(eq(notes.id, note.id));
    invalidateAcademicAutopilotCache(user.id);
    revalidatePath("/notes");
    revalidatePath("/autopilot");
    revalidatePath("/");
    redirectWith("Note deleted.");
  }

  const updates: Partial<typeof notes.$inferInsert> = { updatedAt: new Date() };
  if (action === "favorite") updates.isFavorite = !note.isFavorite;
  else if (action === "pin") updates.isPinned = !note.isPinned;
  else if (action === "archive") updates.isArchived = true;
  else if (action === "restore") updates.isArchived = false;
  else redirectWith("Unknown note action.", "error");

  await db.update(notes).set(updates).where(eq(notes.id, note.id));
  invalidateAcademicAutopilotCache(user.id);
  revalidatePath("/notes");
  revalidatePath("/autopilot");
  revalidatePath("/");
  redirectWith("Note updated.");
}

export async function editNoteAction(formData: FormData) {
  "use server";
  try {
    await verifyCsrfToken(formData);
  } catch {
    redirectWith("Security check failed. Please try again.", "error");
  }
  const user = await currentUser();
  if (!user) redirect("/login");
  const noteId = Number(formData.get("note_id"));
  const title = sanitizePlain(formData.get("title")).slice(0, 255);
  const content = sanitizePlain(formData.get("content"));
  if (!title || !content) redirectWith("Title and content are required.", "error");
  const [note] = await db.select().from(notes).where(and(eq(notes.id, noteId), eq(notes.userId, user.id))).limit(1);
  if (!note) redirectWith("Note not found.", "error");
  const academic = await ownedAcademicSelection(user.id, formData.get("subject_id"), formData.get("topic_id"));
  const fallbackSubject = sanitizePlain(formData.get("subject")).slice(0, 128) || null;
  await db
    .update(notes)
    .set({
      title,
      content,
      subjectId: academic.subjectId,
      topicId: academic.topicId,
      subject: academic.subjectName ?? fallbackSubject,
      tags: sanitizePlain(formData.get("tags")).slice(0, 255) || null,
      isPublic: formData.get("visibility") === "public",
      updatedAt: new Date(),
    })
    .where(eq(notes.id, note.id));
  invalidateAcademicAutopilotCache(user.id);
  revalidatePath("/notes");
  revalidatePath("/autopilot");
  revalidatePath("/");
  redirectWith("Note updated.");
}

export function noteSearchPredicate(userId: number, query: string, showArchived: boolean) {
  const base = [eq(notes.userId, userId), eq(notes.isArchived, showArchived)];
  if (!query) return and(...base);
  const search = `%${query}%`;
  return and(
    ...base,
    or(ilike(notes.title, search), ilike(notes.content, search), ilike(notes.subject, search), ilike(notes.tags, search)),
  );
}

export function noteOrder() {
  return [desc(notes.isPinned), desc(notes.updatedAt), desc(notes.createdAt)] as const;
}
