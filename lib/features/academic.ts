import { and, asc, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  academicDeadlines,
  academicSubjects,
  academicTopics,
  flashcards,
  notes,
  studyMaterials,
  studySessions,
  tasks,
} from "@/db/schema";
import { verifyCsrfToken } from "@/lib/auth/csrf";
import { currentUser } from "@/lib/auth/session";
import { cachedByUser, invalidateUserCache } from "@/lib/cache";
import { parseIsoDate, parsePositiveInteger, sanitizePlain } from "@/lib/text";

const allowedSubjectColors = new Set(["cyan", "blue", "green", "purple", "orange", "pink"]);
const allowedDeadlineTypes = new Set(["assignment", "exam", "quiz", "reading", "project", "revision"]);
const allowedDeadlineStatuses = new Set(["open", "done", "archived"]);
const AUTOPILOT_CACHE_KEY = "academic-autopilot";
const AUTOPILOT_CACHE_SECONDS = 45;

export type StudyRecommendationInput = {
  today: Date;
  deadlineDays: number | null;
  deadlineWeight: number;
  estimatedMinutes: number;
  topicMastery: number | null;
  lastStudiedDaysAgo: number | null;
  materialCount: number;
  noteCount: number;
  openTaskCount: number;
  flashcardCount: number;
};

export type StudyRecommendation = {
  score: number;
  reason: string;
  suggestedMinutes: number;
  urgencyLabel: "low" | "medium" | "high";
};

function redirectWith(message: string, type: "error" | "success" = "success"): never {
  redirect(`/autopilot?${type}=${encodeURIComponent(message)}`);
}

function invalidateAutopilot(userId: number) {
  invalidateUserCache(userId, AUTOPILOT_CACHE_KEY);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function boundedInteger(value: FormDataEntryValue | string | null | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return clamp(parsed, min, max);
}

export function daysBetween(startInput: Date | string, endInput: Date | string) {
  const start = startInput instanceof Date ? startInput : new Date(startInput);
  const end = endInput instanceof Date ? endInput : new Date(endInput);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const startUtc = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endUtc = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.round((endUtc - startUtc) / 86_400_000);
}

export function scoreStudyRecommendation(input: StudyRecommendationInput): StudyRecommendation {
  let score = 0;
  const reasons: string[] = [];

  if (input.deadlineDays !== null) {
    if (input.deadlineDays < 0) {
      score += 45;
      reasons.push("has an overdue academic deadline");
    } else if (input.deadlineDays <= 1) {
      score += 40;
      reasons.push("has a deadline within 24 hours");
    } else if (input.deadlineDays <= 3) {
      score += 32;
      reasons.push("has a deadline in the next few days");
    } else if (input.deadlineDays <= 7) {
      score += 22;
      reasons.push("has a deadline this week");
    } else {
      score += 10;
      reasons.push("has a future deadline to prepare for");
    }
    score += clamp(input.deadlineWeight, 1, 5) * 4;
  }

  if (input.topicMastery !== null) {
    const masteryGap = clamp(80 - input.topicMastery, 0, 80);
    if (masteryGap > 0) {
      score += Math.round(masteryGap * 0.45);
      reasons.push(`topic mastery is ${input.topicMastery}%`);
    }
  }

  if (input.lastStudiedDaysAgo === null) {
    score += 14;
    reasons.push("has not been studied yet");
  } else if (input.lastStudiedDaysAgo >= 14) {
    score += 18;
    reasons.push("has not been studied for two weeks");
  } else if (input.lastStudiedDaysAgo >= 7) {
    score += 12;
    reasons.push("has not been studied this week");
  }

  if (input.openTaskCount > 0) {
    score += Math.min(input.openTaskCount * 5, 20);
    reasons.push(`${input.openTaskCount} open task${input.openTaskCount === 1 ? "" : "s"} remain`);
  }

  if (input.materialCount > 0) score += Math.min(input.materialCount * 3, 12);
  if (input.noteCount > 0) score += Math.min(input.noteCount * 2, 8);
  if (input.flashcardCount > 0) score += Math.min(input.flashcardCount * 2, 8);

  if (!reasons.length) reasons.push("is the best available subject to start organizing");
  const urgencyLabel = score >= 70 ? "high" : score >= 40 ? "medium" : "low";
  return {
    score,
    reason: reasons.slice(0, 3).join(", "),
    suggestedMinutes: clamp(Math.ceil(input.estimatedMinutes / 15) * 15 || 30, 25, 120),
    urgencyLabel,
  };
}

export async function createSubjectAction(formData: FormData) {
  "use server";
  try {
    await verifyCsrfToken(formData);
  } catch {
    redirectWith("Security check failed. Please try again.", "error");
  }
  const user = await currentUser();
  if (!user) redirect("/login");
  const name = sanitizePlain(formData.get("name")).slice(0, 160);
  const code = sanitizePlain(formData.get("code")).slice(0, 64) || null;
  const requestedColor = sanitizePlain(formData.get("color"));
  const color = allowedSubjectColors.has(requestedColor) ? requestedColor : "cyan";
  const targetMastery = boundedInteger(formData.get("target_mastery"), 80, 50, 100);
  if (!name) redirectWith("Subject name is required.", "error");

  await db.insert(academicSubjects).values({
    userId: user.id,
    name,
    code,
    color,
    targetMastery,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).onConflictDoNothing();
  invalidateAutopilot(user.id);
  revalidatePath("/autopilot");
  revalidatePath("/");
  redirectWith("Subject added.");
}

export async function createTopicAction(formData: FormData) {
  "use server";
  try {
    await verifyCsrfToken(formData);
  } catch {
    redirectWith("Security check failed. Please try again.", "error");
  }
  const user = await currentUser();
  if (!user) redirect("/login");
  const subjectId = parsePositiveInteger(formData.get("subject_id"));
  const name = sanitizePlain(formData.get("name")).slice(0, 180);
  const description = sanitizePlain(formData.get("description")) || null;
  const masteryScore = boundedInteger(formData.get("mastery_score"), 0, 0, 100);
  if (!subjectId || !name) redirectWith("Choose a subject and topic name.", "error");
  const [subject] = await db
    .select({ id: academicSubjects.id })
    .from(academicSubjects)
    .where(and(eq(academicSubjects.id, subjectId), eq(academicSubjects.userId, user.id)))
    .limit(1);
  if (!subject) redirectWith("Choose a subject and topic name.", "error");

  await db.insert(academicTopics).values({
    userId: user.id,
    subjectId: subject.id,
    name,
    description,
    masteryScore,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).onConflictDoNothing();
  invalidateAutopilot(user.id);
  revalidatePath("/autopilot");
  redirectWith("Topic added.");
}

export async function createAcademicDeadlineAction(formData: FormData) {
  "use server";
  try {
    await verifyCsrfToken(formData);
  } catch {
    redirectWith("Security check failed. Please try again.", "error");
  }
  const user = await currentUser();
  if (!user) redirect("/login");
  const title = sanitizePlain(formData.get("title")).slice(0, 255);
  const dueDate = parseIsoDate(formData.get("due_date"));
  const requestedType = sanitizePlain(formData.get("type"));
  const type = allowedDeadlineTypes.has(requestedType) ? requestedType : "assignment";
  const estimatedMinutes = boundedInteger(formData.get("estimated_minutes"), 60, 15, 720);
  const weight = boundedInteger(formData.get("weight"), 1, 1, 5);
  const notesText = sanitizePlain(formData.get("notes")) || null;
  if (!title || !dueDate) redirectWith("Deadline title and due date are required.", "error");
  const academic = await ownedAcademicSelection(user.id, formData.get("subject_id"), formData.get("topic_id"));

  await db.insert(academicDeadlines).values({
    userId: user.id,
    subjectId: academic.subjectId,
    topicId: academic.topicId,
    title,
    type,
    dueDate,
    estimatedMinutes,
    weight,
    notes: notesText,
    status: "open",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  invalidateAutopilot(user.id);
  revalidatePath("/autopilot");
  revalidatePath("/");
  redirectWith("Academic deadline added.");
}

export async function updateAcademicDeadlineStatusAction(formData: FormData) {
  "use server";
  try {
    await verifyCsrfToken(formData);
  } catch {
    redirectWith("Security check failed. Please try again.", "error");
  }
  const user = await currentUser();
  if (!user) redirect("/login");
  const deadlineId = parsePositiveInteger(formData.get("deadline_id"));
  const status = sanitizePlain(formData.get("status"));
  if (!allowedDeadlineStatuses.has(status)) redirectWith("Unknown deadline status.", "error");
  if (!deadlineId) redirectWith("Academic deadline not found.", "error");
  const [deadline] = await db
    .select({ id: academicDeadlines.id })
    .from(academicDeadlines)
    .where(and(eq(academicDeadlines.id, deadlineId), eq(academicDeadlines.userId, user.id)))
    .limit(1);
  if (!deadline) redirectWith("Academic deadline not found.", "error");
  await db.update(academicDeadlines).set({ status, updatedAt: new Date() }).where(and(eq(academicDeadlines.id, deadline.id), eq(academicDeadlines.userId, user.id)));
  invalidateAutopilot(user.id);
  revalidatePath("/autopilot");
  revalidatePath("/");
  redirectWith(status === "done" ? "Deadline completed." : "Deadline updated.");
}

export async function getAcademicAutopilot(userId: number) {
  return cachedByUser(AUTOPILOT_CACHE_KEY, userId, AUTOPILOT_CACHE_SECONDS, () => loadAcademicAutopilot(userId));
}

export async function getAcademicOptions(userId: number) {
  const [subjects, topics] = await Promise.all([
    db
      .select({ id: academicSubjects.id, name: academicSubjects.name, code: academicSubjects.code })
      .from(academicSubjects)
      .where(and(eq(academicSubjects.userId, userId), eq(academicSubjects.archived, false)))
      .orderBy(asc(academicSubjects.name)),
    db
      .select({ id: academicTopics.id, subjectId: academicTopics.subjectId, name: academicTopics.name })
      .from(academicTopics)
      .where(eq(academicTopics.userId, userId))
      .orderBy(asc(academicTopics.name)),
  ]);
  return { subjects, topics };
}

export async function ownedAcademicSelection(userId: number, subjectIdInput: FormDataEntryValue | null, topicIdInput: FormDataEntryValue | null) {
  const subjectId = Number(subjectIdInput || 0) || null;
  const topicId = Number(topicIdInput || 0) || null;
  if (!subjectId) return { subjectId: null, topicId: null, subjectName: null };

  const [subject] = await db
    .select({ id: academicSubjects.id, name: academicSubjects.name })
    .from(academicSubjects)
    .where(and(eq(academicSubjects.id, subjectId), eq(academicSubjects.userId, userId), eq(academicSubjects.archived, false)))
    .limit(1);
  if (!subject) return { subjectId: null, topicId: null, subjectName: null };
  if (!topicId) return { subjectId: subject.id, topicId: null, subjectName: subject.name };

  const [topic] = await db
    .select({ id: academicTopics.id })
    .from(academicTopics)
    .where(and(eq(academicTopics.id, topicId), eq(academicTopics.userId, userId), eq(academicTopics.subjectId, subject.id)))
    .limit(1);
  return {
    subjectId: subject.id,
    topicId: topic?.id ?? null,
    subjectName: subject.name,
  };
}

async function loadAcademicAutopilot(userId: number) {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const nextMonth = new Date(today);
  nextMonth.setDate(nextMonth.getDate() + 30);
  const nextMonthIso = nextMonth.toISOString().slice(0, 10);

  const [subjectRows, topicRows, deadlineRows, materialRows, noteRows, taskRows, flashcardRows, sessionRows] = await Promise.all([
    db.select().from(academicSubjects).where(and(eq(academicSubjects.userId, userId), eq(academicSubjects.archived, false))).orderBy(asc(academicSubjects.name)),
    db.select().from(academicTopics).where(eq(academicTopics.userId, userId)).orderBy(asc(academicTopics.name)),
    db.select().from(academicDeadlines).where(and(eq(academicDeadlines.userId, userId), eq(academicDeadlines.status, "open"), lte(academicDeadlines.dueDate, nextMonthIso))).orderBy(asc(academicDeadlines.dueDate)),
    db.select({ subjectId: studyMaterials.subjectId, total: count() }).from(studyMaterials).where(eq(studyMaterials.userId, userId)).groupBy(studyMaterials.subjectId),
    db.select({ subjectId: notes.subjectId, total: count() }).from(notes).where(and(eq(notes.userId, userId), eq(notes.isArchived, false))).groupBy(notes.subjectId),
    db.select({ subjectId: tasks.subjectId, total: count() }).from(tasks).where(and(eq(tasks.userId, userId), eq(tasks.completed, false), eq(tasks.archived, false))).groupBy(tasks.subjectId),
    db.select({ subjectId: flashcards.subjectId, total: count() }).from(flashcards).where(eq(flashcards.userId, userId)).groupBy(flashcards.subjectId),
    db
      .select({ subjectId: studySessions.subjectId, lastStudiedAt: sql<Date | null>`max(${studySessions.endedAt})` })
      .from(studySessions)
      .where(eq(studySessions.userId, userId))
      .groupBy(studySessions.subjectId),
  ]);

  const bySubject = <T extends { subjectId: number | null; total?: number; lastStudiedAt?: Date | null }>(rows: T[]) => {
    const map = new Map<number, T>();
    rows.forEach((row) => {
      if (row.subjectId) map.set(row.subjectId, row);
    });
    return map;
  };
  const materialsBySubject = bySubject(materialRows);
  const notesBySubject = bySubject(noteRows);
  const tasksBySubject = bySubject(taskRows);
  const flashcardsBySubject = bySubject(flashcardRows);
  const sessionsBySubject = bySubject(sessionRows);

  const topicBySubject = new Map<number, typeof topicRows[number][]>();
  topicRows.forEach((topic) => {
    const existing = topicBySubject.get(topic.subjectId) ?? [];
    existing.push(topic);
    topicBySubject.set(topic.subjectId, existing);
  });
  const deadlineBySubject = new Map<number, typeof deadlineRows[number][]>();
  deadlineRows.forEach((deadline) => {
    if (!deadline.subjectId) return;
    const existing = deadlineBySubject.get(deadline.subjectId) ?? [];
    existing.push(deadline);
    deadlineBySubject.set(deadline.subjectId, existing);
  });

  const recommendations = subjectRows.map((subject) => {
    const subjectTopics = topicBySubject.get(subject.id) ?? [];
    const weakestTopic = subjectTopics.length ? [...subjectTopics].sort((a, b) => a.masteryScore - b.masteryScore)[0] : null;
    const nearestDeadline = (deadlineBySubject.get(subject.id) ?? [])[0] ?? null;
    const lastStudiedAt = sessionsBySubject.get(subject.id)?.lastStudiedAt ?? weakestTopic?.lastStudiedAt ?? null;
    const lastStudiedDaysAgo = lastStudiedAt ? daysBetween(lastStudiedAt, today) : null;
    const deadlineDays = nearestDeadline?.dueDate ? daysBetween(today, new Date(`${nearestDeadline.dueDate}T00:00:00Z`)) : null;
    const recommendation = scoreStudyRecommendation({
      today,
      deadlineDays,
      deadlineWeight: nearestDeadline?.weight ?? 1,
      estimatedMinutes: nearestDeadline?.estimatedMinutes ?? 45,
      topicMastery: weakestTopic?.masteryScore ?? null,
      lastStudiedDaysAgo,
      materialCount: Number(materialsBySubject.get(subject.id)?.total ?? 0),
      noteCount: Number(notesBySubject.get(subject.id)?.total ?? 0),
      openTaskCount: Number(tasksBySubject.get(subject.id)?.total ?? 0),
      flashcardCount: Number(flashcardsBySubject.get(subject.id)?.total ?? 0),
    });
    return {
      subject,
      weakestTopic,
      nearestDeadline,
      lastStudiedAt,
      materialCount: Number(materialsBySubject.get(subject.id)?.total ?? 0),
      noteCount: Number(notesBySubject.get(subject.id)?.total ?? 0),
      openTaskCount: Number(tasksBySubject.get(subject.id)?.total ?? 0),
      flashcardCount: Number(flashcardsBySubject.get(subject.id)?.total ?? 0),
      ...recommendation,
    };
  }).sort((a, b) => b.score - a.score);

  const unlinked = {
    materials: Number(materialRows.find((row) => row.subjectId === null)?.total ?? 0),
    notes: Number(noteRows.find((row) => row.subjectId === null)?.total ?? 0),
    tasks: Number(taskRows.find((row) => row.subjectId === null)?.total ?? 0),
    flashcards: Number(flashcardRows.find((row) => row.subjectId === null)?.total ?? 0),
  };

  const openDeadlines = await db
    .select()
    .from(academicDeadlines)
    .where(and(eq(academicDeadlines.userId, userId), eq(academicDeadlines.status, "open"), gte(academicDeadlines.dueDate, todayIso)))
    .orderBy(asc(academicDeadlines.dueDate), desc(academicDeadlines.weight))
    .limit(8);

  return {
    subjects: subjectRows,
    topics: topicRows,
    openDeadlines,
    recommendations,
    primaryRecommendation: recommendations[0] ?? null,
    unlinked,
  };
}

export function invalidateAcademicAutopilotCache(userId: number) {
  invalidateAutopilot(userId);
}
