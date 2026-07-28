import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { flashcardCards, flashcards } from "@/db/schema";
import { verifyCsrfToken } from "@/lib/auth/csrf";
import { currentUser } from "@/lib/auth/session";
import { sanitizePlain } from "@/lib/text";

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
  if (!title || !question || !answer) redirectWith("Please provide title, question, and answer.", "error");

  const [deck] = await db
    .insert(flashcards)
    .values({
      userId: user.id,
      title,
      createdAt: new Date(),
      isPublic: formData.get("visibility") === "public",
    })
    .returning();
  await db.insert(flashcardCards).values({ flashcardId: deck.id, front: question, back: answer });
  revalidatePath("/flashcards");
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
  const flashcardId = Number(formData.get("flashcard_id"));
  const [deck] = await db
    .select()
    .from(flashcards)
    .where(and(eq(flashcards.id, flashcardId), eq(flashcards.userId, user.id)))
    .limit(1);
  if (!deck) redirectWith("Flashcard not found.", "error");
  await db.delete(flashcards).where(eq(flashcards.id, deck.id));
  revalidatePath("/flashcards");
  redirectWith("Flashcard deleted.");
}

export function flashcardOrder() {
  return [desc(flashcards.createdAt), desc(flashcards.id)] as const;
}

export function trendingFlashcardOrder() {
  return [desc(flashcards.id)] as const;
}
