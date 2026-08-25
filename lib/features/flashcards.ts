import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { flashcardCards, flashcards } from "@/db/schema";
import { verifyCsrfToken } from "@/lib/auth/csrf";
import { currentUser } from "@/lib/auth/session";
import { invalidateAcademicAutopilotCache, ownedAcademicSelection } from "@/lib/features/academic";
import { parsePositiveInteger, sanitizePlain } from "@/lib/text";

function redirectWith(message: string, type: "error" | "success" = "success"): never {
  redirect(`/flashcards?${type}=${encodeURIComponent(message)}`);
}

export async function createFlashcardAction(formData: FormData) {
  "use server";
  try {
    await verifyCsrfToken(formData);
  } catch {
    redirectWith("Security check failed. Please try again.", "error");
  }
  const user = await currentUser();
  if (!user) redirect("/login");
  const title = sanitizePlain(formData.get("title")).slice(0, 255);
  const question = sanitizePlain(formData.get("question"));
  const answer = sanitizePlain(formData.get("answer"));
  const academic = await ownedAcademicSelection(user.id, formData.get("subject_id"), formData.get("topic_id"));
  if (!title || !question || !answer) redirectWith("Please provide title, question, and answer.", "error");

  await db.transaction(async (tx) => {
    const [deck] = await tx
      .insert(flashcards)
      .values({
        userId: user.id,
        subjectId: academic.subjectId,
        topicId: academic.topicId,
        title,
        createdAt: new Date(),
        isPublic: formData.get("visibility") === "public",
      })
      .returning();
    await tx.insert(flashcardCards).values({ flashcardId: deck.id, front: question, back: answer });
  });
  invalidateAcademicAutopilotCache(user.id);
  revalidatePath("/flashcards");
  revalidatePath("/autopilot");
  revalidatePath("/");
  redirectWith("Flashcard created successfully.");
}

export async function deleteFlashcardAction(formData: FormData) {
  "use server";
  try {
    await verifyCsrfToken(formData);
  } catch {
    redirectWith("Security check failed. Please try again.", "error");
  }
  const user = await currentUser();
  if (!user) redirect("/login");
  const flashcardId = parsePositiveInteger(formData.get("flashcard_id"));
  if (!flashcardId) redirectWith("Flashcard not found.", "error");
  const [deck] = await db
    .select()
    .from(flashcards)
    .where(and(eq(flashcards.id, flashcardId), eq(flashcards.userId, user.id)))
    .limit(1);
  if (!deck) redirectWith("Flashcard not found.", "error");
  await db.delete(flashcards).where(and(eq(flashcards.id, deck.id), eq(flashcards.userId, user.id)));
  invalidateAcademicAutopilotCache(user.id);
  revalidatePath("/flashcards");
  revalidatePath("/autopilot");
  revalidatePath("/");
  redirectWith("Flashcard deleted.");
}

export function flashcardOrder() {
  return [desc(flashcards.createdAt), desc(flashcards.id)] as const;
}

export function trendingFlashcardOrder() {
  return [desc(flashcards.id)] as const;
}
