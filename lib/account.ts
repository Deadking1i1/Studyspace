import { and, asc, eq, inArray, ne, or } from "drizzle-orm";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { db } from "@/db";
import {
  academicDeadlines,
  academicSubjects,
  academicTopics,
  achievements,
  comments,
  events,
  flashcardCards,
  flashcards,
  groupMembers,
  groups,
  likes,
  notes,
  notifications,
  posts,
  securityEvents,
  studyMaterials,
  studySessions,
  tasks,
  userProfiles,
  userSettings,
  users,
} from "@/db/schema";
import { deletePrivateObject } from "@/lib/storage";

export function normalizeEmail(value: FormDataEntryValue | string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

export async function ensureAccountRecords(user: { id: number; username: string; bio?: string | null; profilePic?: string | null; course?: string | null }) {
  await Promise.all([
    db.insert(userProfiles).values({
      userId: user.id,
      displayName: user.username,
      bio: user.bio ?? null,
      profilePic: user.profilePic ?? null,
      course: user.course ?? null,
      profileVisibility: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoNothing({ target: userProfiles.userId }),
    db.insert(userSettings).values({ userId: user.id, createdAt: new Date(), updatedAt: new Date() })
      .onConflictDoNothing({ target: userSettings.userId }),
  ]);
}

export async function exportUserData(userId: number) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("User not found.");
  const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  const userFlashcards = await db.select().from(flashcards).where(eq(flashcards.userId, userId));
  const flashcardIds = userFlashcards.map((item) => item.id);
  return {
    exported_at: new Date().toISOString(),
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      email_verified: user.emailVerified,
      pending_email: user.pendingEmail,
      created_at: user.createdAt?.toISOString?.() ?? null,
      streak_days: user.streakDays,
      total_hours: user.totalHours,
    },
    profile,
    settings,
    security_history: await db.select().from(securityEvents).where(eq(securityEvents.userId, userId)),
    academic: {
      subjects: await db.select().from(academicSubjects).where(eq(academicSubjects.userId, userId)),
      topics: await db.select().from(academicTopics).where(eq(academicTopics.userId, userId)),
      deadlines: await db.select().from(academicDeadlines).where(eq(academicDeadlines.userId, userId)),
    },
    notes: await db.select().from(notes).where(eq(notes.userId, userId)),
    study_materials: await db.select().from(studyMaterials).where(eq(studyMaterials.userId, userId)),
    tasks: await db.select().from(tasks).where(eq(tasks.userId, userId)),
    events: await db.select().from(events).where(eq(events.userId, userId)),
    study_sessions: await db.select().from(studySessions).where(eq(studySessions.userId, userId)),
    flashcards: {
      decks: userFlashcards,
      cards: flashcardIds.length ? await db.select().from(flashcardCards).where(inArray(flashcardCards.flashcardId, flashcardIds)) : [],
    },
    achievements: await db.select().from(achievements).where(eq(achievements.userId, userId)),
    notifications: await db.select().from(notifications).where(eq(notifications.userId, userId)),
    groups: {
      memberships: await db.select().from(groupMembers).where(eq(groupMembers.userId, userId)),
      created: await db.select().from(groups).where(eq(groups.createdBy, userId)),
    },
    community: {
      posts: await db.select().from(posts).where(eq(posts.userId, userId)),
      comments: await db.select().from(comments).where(eq(comments.userId, userId)),
      note_likes: await db.select().from(likes).where(eq(likes.userId, userId)),
    },
  };
}

export async function deleteUserAccount(userId: number) {
  const materialFiles = await db.select({ storagePath: studyMaterials.storagePath }).from(studyMaterials).where(eq(studyMaterials.userId, userId));
  const [profileImage] = await db.select({ profilePic: userProfiles.profilePic }).from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  await db.transaction(async (tx) => {
    const userNotes = await tx.select({ id: notes.id }).from(notes).where(eq(notes.userId, userId));
    const noteIds = userNotes.map((note) => note.id);
    const userFlashcards = await tx.select({ id: flashcards.id }).from(flashcards).where(eq(flashcards.userId, userId));
    const flashcardIds = userFlashcards.map((card) => card.id);
    const createdGroups = await tx.select({ id: groups.id }).from(groups).where(eq(groups.createdBy, userId));
    const orphanedGroupIds: number[] = [];

    for (const group of createdGroups) {
      const [replacement] = await tx
        .select()
        .from(groupMembers)
        .where(and(eq(groupMembers.groupId, group.id), ne(groupMembers.userId, userId)))
        .orderBy(asc(groupMembers.joinedAt))
        .limit(1);
      if (replacement) {
        await tx.update(groups).set({ createdBy: replacement.userId }).where(eq(groups.id, group.id));
      } else {
        orphanedGroupIds.push(group.id);
      }
    }

    const postPredicates = [eq(posts.userId, userId)];
    if (orphanedGroupIds.length) postPredicates.push(inArray(posts.groupId, orphanedGroupIds));
    const userPosts = await tx.select({ id: posts.id }).from(posts).where(or(...postPredicates));
    const postIds = userPosts.map((post) => post.id);
    if (postIds.length) await tx.delete(comments).where(or(eq(comments.userId, userId), inArray(comments.postId, postIds)));
    else await tx.delete(comments).where(eq(comments.userId, userId));
    if (postIds.length) await tx.delete(posts).where(inArray(posts.id, postIds));

    if (orphanedGroupIds.length) {
      await tx.delete(groupMembers).where(inArray(groupMembers.groupId, orphanedGroupIds));
      await tx.delete(groups).where(inArray(groups.id, orphanedGroupIds));
    }
    await tx.delete(groupMembers).where(eq(groupMembers.userId, userId));

    if (noteIds.length) await tx.delete(likes).where(or(eq(likes.userId, userId), inArray(likes.noteId, noteIds)));
    else await tx.delete(likes).where(eq(likes.userId, userId));
    if (noteIds.length) await tx.delete(notes).where(inArray(notes.id, noteIds));

    if (flashcardIds.length) {
      await tx.delete(flashcardCards).where(inArray(flashcardCards.flashcardId, flashcardIds));
      await tx.delete(flashcards).where(inArray(flashcards.id, flashcardIds));
    }

    await tx.delete(achievements).where(eq(achievements.userId, userId));
    await tx.delete(notifications).where(eq(notifications.userId, userId));
    await tx.delete(studyMaterials).where(eq(studyMaterials.userId, userId));
    await tx.delete(events).where(eq(events.userId, userId));
    await tx.delete(studySessions).where(eq(studySessions.userId, userId));
    await tx.delete(tasks).where(eq(tasks.userId, userId));
    await tx.delete(userProfiles).where(eq(userProfiles.userId, userId));
    await tx.delete(userSettings).where(eq(userSettings.userId, userId));
    await tx.update(securityEvents).set({ userId: null }).where(eq(securityEvents.userId, userId));
    await tx.delete(users).where(eq(users.id, userId));
  });
  const storageKeys = [
    ...materialFiles.map((material) => material.storagePath),
    ...(profileImage?.profilePic?.startsWith("profile-images/") ? [profileImage.profilePic] : []),
  ];
  await Promise.all(storageKeys.map(async (storageKey) => {
    if (path.isAbsolute(storageKey)) {
      await unlink(storageKey).catch(() => undefined);
      return;
    }
    await deletePrivateObject(storageKey).catch(() => undefined);
  }));
}
