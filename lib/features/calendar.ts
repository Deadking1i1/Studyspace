import { and, asc, eq, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { events } from "@/db/schema";
import { verifyCsrfToken } from "@/lib/auth/csrf";
import { currentUser } from "@/lib/auth/session";
import { parseIsoDate, parsePositiveInteger, sanitizePlain } from "@/lib/text";

function redirectWith(message: string, type: "error" | "success" = "success"): never {
  redirect(`/calendar?${type}=${encodeURIComponent(message)}`);
}

export async function createEventAction(formData: FormData) {
  "use server";
  try {
    await verifyCsrfToken(formData);
  } catch {
    redirectWith("Security check failed. Please try again.", "error");
  }
  const user = await currentUser();
  if (!user) redirect("/login");
  const name = sanitizePlain(formData.get("name")).slice(0, 255);
  const eventDate = parseIsoDate(formData.get("event_date"));
  const notes = sanitizePlain(formData.get("notes")) || null;
  if (!name || !eventDate) redirectWith("Event name and date are required.", "error");

  await db.insert(events).values({ userId: user.id, name, eventDate, notes });
  revalidatePath("/calendar");
  redirectWith("Event added to your study calendar.");
}

export async function deleteEventAction(formData: FormData) {
  "use server";
  try {
    await verifyCsrfToken(formData);
  } catch {
    redirectWith("Security check failed. Please try again.", "error");
  }
  const user = await currentUser();
  if (!user) redirect("/login");
  const eventId = parsePositiveInteger(formData.get("event_id"));
  if (!eventId) redirectWith("Event not found.", "error");
  const [event] = await db.select().from(events).where(and(eq(events.id, eventId), eq(events.userId, user.id))).limit(1);
  if (!event) redirectWith("Event not found.", "error");
  await db.delete(events).where(and(eq(events.id, event.id), eq(events.userId, user.id)));
  revalidatePath("/calendar");
  redirectWith("Event deleted.");
}

export function upcomingEventsPredicate(userId: number, today: string) {
  return and(eq(events.userId, userId), gte(events.eventDate, today));
}

export function eventOrder() {
  return [asc(events.eventDate), asc(events.id)] as const;
}
