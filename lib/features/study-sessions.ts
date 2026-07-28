import { and, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { studySessions } from "@/db/schema";
import { verifyCsrfToken } from "@/lib/auth/csrf";
import { currentUser } from "@/lib/auth/session";

export function validateStudySessionDuration(value: FormDataEntryValue | string | null | undefined) {
  const duration = Number(value);
  if (!Number.isInteger(duration) || duration < 1 || duration > 720) return null;
  return duration;
}

function redirectWith(message: string, type: "error" | "success" = "success"): never {
  redirect(`/timer?${type}=${encodeURIComponent(message)}`);
}

export async function saveStudySessionAction(formData: FormData) {
  "use server";
  try {
    await verifyCsrfToken(formData);
  } catch {
    redirectWith("Security check failed. Please try again.", "error");
  }
  const user = await currentUser();
  if (!user) redirect("/login");
  const durationMinutes = validateStudySessionDuration(formData.get("duration_minutes"));
  if (!durationMinutes) redirectWith("Session duration must be between 1 and 720 minutes.", "error");

  const endedAt = new Date();
  const startedAt = new Date(endedAt.getTime() - durationMinutes * 60_000);
  await db.insert(studySessions).values({
    userId: user.id,
    durationMinutes,
    startedAt,
    endedAt,
  });
  revalidatePath("/timer");
  redirectWith("Study session saved.");
}

export async function getStudySessionStats(userId: number) {
  const [row] = await db
    .select({
      sessionsCompleted: sql<number>`count(*)::int`,
      totalMinutes: sql<number>`coalesce(sum(${studySessions.durationMinutes}), 0)::int`,
    })
    .from(studySessions)
    .where(eq(studySessions.userId, userId));
  return row ?? { sessionsCompleted: 0, totalMinutes: 0 };
}

export function recentStudySessionPredicate(userId: number) {
  return and(eq(studySessions.userId, userId));
}

export function studySessionOrder() {
  return [desc(studySessions.endedAt), desc(studySessions.id)] as const;
}
