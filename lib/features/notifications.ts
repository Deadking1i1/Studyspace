import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { verifyCsrfToken } from "@/lib/auth/csrf";
import { currentUser } from "@/lib/auth/session";

function redirectWith(message: string, type: "error" | "success" = "success"): never {
  redirect(`/notifications?${type}=${encodeURIComponent(message)}`);
}

export async function markNotificationReadAction(formData: FormData) {
  "use server";
  try {
    await verifyCsrfToken(formData);
  } catch {
    redirectWith("Security check failed. Please try again.", "error");
  }
  const user = await currentUser();
  if (!user) redirect("/login");
  const notificationId = Number(formData.get("notification_id"));
  const [notification] = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, user.id)))
    .limit(1);
  if (!notification) redirectWith("Notification not found.", "error");
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, notification.id));
  revalidatePath("/notifications");
  redirectWith("Notification marked as read.");
}

export async function markAllNotificationsReadAction(formData: FormData) {
  "use server";
  try {
    await verifyCsrfToken(formData);
  } catch {
    redirectWith("Security check failed. Please try again.", "error");
  }
  const user = await currentUser();
  if (!user) redirect("/login");
  await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false)));
  revalidatePath("/notifications");
  redirectWith("All notifications marked as read.");
}

export function notificationOrder() {
  return [desc(notifications.createdAt), desc(notifications.id)] as const;
}
