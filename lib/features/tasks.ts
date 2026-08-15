import { and, asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { verifyCsrfToken } from "@/lib/auth/csrf";
import { currentUser } from "@/lib/auth/session";
import { invalidateAcademicAutopilotCache, ownedAcademicSelection } from "@/lib/features/academic";
import { parseIsoDate, sanitizePlain } from "@/lib/text";

const allowedPriorities = new Set(["low", "medium", "high"]);
const allowedActions = new Set(["complete", "reopen", "archive", "restore", "delete"]);

function redirectWith(message: string, type: "error" | "success" = "success"): never {
  redirect(`/tasks?${type}=${encodeURIComponent(message)}`);
}

export async function createTaskAction(formData: FormData) {
  "use server";
  try {
    await verifyCsrfToken(formData);
  } catch {
    redirectWith("Security check failed. Please try again.", "error");
  }
  const user = await currentUser();
  if (!user) redirect("/login");
  const task = sanitizePlain(formData.get("task"));
  const subject = sanitizePlain(formData.get("subject")).slice(0, 128) || null;
  const dueDate = parseIsoDate(formData.get("due"));
  const requestedPriority = sanitizePlain(formData.get("priority"));
  const priority = allowedPriorities.has(requestedPriority) ? requestedPriority : "medium";
  const academic = await ownedAcademicSelection(user.id, formData.get("subject_id"), formData.get("topic_id"));
  if (!task || !dueDate) redirectWith("Task and due date are required.", "error");

  await db.insert(tasks).values({
    userId: user.id,
    subjectId: academic.subjectId,
    topicId: academic.topicId,
    task,
    subject: academic.subjectName ?? subject,
    priority,
    dueDate,
    completed: false,
    archived: false,
    createdAt: new Date(),
  });
  invalidateAcademicAutopilotCache(user.id);
  revalidatePath("/tasks");
  revalidatePath("/autopilot");
  revalidatePath("/");
  redirectWith("Task added to your planner.");
}

export async function updateTaskStateAction(formData: FormData) {
  "use server";
  try {
    await verifyCsrfToken(formData);
  } catch {
    redirectWith("Security check failed. Please try again.", "error");
  }
  const user = await currentUser();
  if (!user) redirect("/login");
  const taskId = Number(formData.get("task_id"));
  const action = sanitizePlain(formData.get("action"));
  if (!allowedActions.has(action)) redirectWith("Unknown task action.", "error");
  const [task] = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id))).limit(1);
  if (!task) redirectWith("Task not found.", "error");

  if (action === "delete") {
    await db.delete(tasks).where(eq(tasks.id, task.id));
    invalidateAcademicAutopilotCache(user.id);
    revalidatePath("/tasks");
    revalidatePath("/autopilot");
    revalidatePath("/");
    redirectWith("Task deleted.");
  }

  const updates: Partial<typeof tasks.$inferInsert> = {};
  if (action === "complete") updates.completed = true;
  if (action === "reopen") {
    updates.completed = false;
    updates.archived = false;
  }
  if (action === "archive") updates.archived = true;
  if (action === "restore") updates.archived = false;

  await db.update(tasks).set(updates).where(eq(tasks.id, task.id));
  invalidateAcademicAutopilotCache(user.id);
  revalidatePath("/tasks");
  revalidatePath("/autopilot");
  revalidatePath("/");
  redirectWith(action === "complete" ? "Task marked complete." : "Task updated.");
}

export function taskStatusPredicate(userId: number, status: string, priority: string) {
  const predicates = [eq(tasks.userId, userId)];
  if (status === "completed") predicates.push(eq(tasks.completed, true), eq(tasks.archived, false));
  else if (status === "archived") predicates.push(eq(tasks.archived, true));
  else predicates.push(eq(tasks.completed, false), eq(tasks.archived, false));
  if (allowedPriorities.has(priority)) predicates.push(eq(tasks.priority, priority));
  return and(...predicates);
}

export function taskOrder() {
  return [asc(tasks.dueDate), desc(tasks.priority)] as const;
}
