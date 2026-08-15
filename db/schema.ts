import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    username: varchar("username", { length: 128 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    emailVerificationTokenHash: varchar("email_verification_token_hash", { length: 64 }),
    emailVerificationSentAt: timestamp("email_verification_sent_at", { withTimezone: true }),
    pendingEmail: varchar("pending_email", { length: 255 }),
    pendingEmailTokenHash: varchar("pending_email_token_hash", { length: 64 }),
    pendingEmailSentAt: timestamp("pending_email_sent_at", { withTimezone: true }),
    passwordResetTokenHash: varchar("password_reset_token_hash", { length: 64 }),
    passwordResetSentAt: timestamp("password_reset_sent_at", { withTimezone: true }),
    course: varchar("course", { length: 128 }),
    bio: text("bio"),
    profilePic: varchar("profile_pic", { length: 255 }),
    streakDays: integer("streak_days").notNull().default(0),
    totalHours: integer("total_hours").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: uniqueIndex("ux_users_email").on(table.email),
    usernameIdx: uniqueIndex("ux_users_username").on(table.username),
  }),
);

export const userSessions = pgTable(
  "user_sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: varchar("user_agent", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => ({
    tokenHashIdx: uniqueIndex("ux_user_sessions_token_hash").on(table.tokenHash),
    userExpiresIdx: index("ix_user_sessions_user_expires").on(table.userId, table.expiresAt),
  }),
);

export const authRateLimits = pgTable(
  "auth_rate_limits",
  {
    id: serial("id").primaryKey(),
    action: varchar("action", { length: 64 }).notNull(),
    identifierHash: varchar("identifier_hash", { length: 64 }).notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueWindowIdx: uniqueIndex("uq_auth_rate_limits_action_identifier_window").on(
      table.action,
      table.identifierHash,
      table.windowStart,
    ),
    actionUpdatedIdx: index("ix_auth_rate_limits_action_updated").on(table.action, table.updatedAt),
  }),
);

export const integrationTokens = pgTable(
  "integration_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 64 }).notNull(),
    accessTokenEncrypted: text("access_token_encrypted").notNull(),
    refreshTokenEncrypted: text("refresh_token_encrypted"),
    scope: text("scope"),
    metadata: jsonb("metadata"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueProviderIdx: uniqueIndex("uq_integration_tokens_user_provider").on(table.userId, table.provider),
  }),
);

export const userProfiles = pgTable(
  "user_profiles",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
    displayName: varchar("display_name", { length: 128 }),
    bio: text("bio"),
    profilePic: varchar("profile_pic", { length: 255 }),
    course: varchar("course", { length: 128 }),
    institution: varchar("institution", { length: 255 }),
    educationLevel: varchar("education_level", { length: 128 }),
    fieldOfStudy: varchar("field_of_study", { length: 128 }),
    country: varchar("country", { length: 128 }),
    profileVisibility: varchar("profile_visibility", { length: 32 }).notNull().default("private"),
    showEmail: boolean("show_email").notNull().default(false),
    showAcademicProfile: boolean("show_academic_profile").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    visibilityIdx: index("ix_user_profiles_visibility").on(table.profileVisibility),
  }),
);

export const userSettings = pgTable(
  "user_settings",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
    theme: varchar("theme", { length: 32 }).notNull().default("dark"),
    language: varchar("language", { length: 16 }).notNull().default("en"),
    timezone: varchar("timezone", { length: 64 }).notNull().default("UTC"),
    reducedMotion: boolean("reduced_motion").notNull().default(false),
    highContrast: boolean("high_contrast").notNull().default(false),
    emailNotifications: boolean("email_notifications").notNull().default(true),
    studyReminders: boolean("study_reminders").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => ({}),
);

export const securityEvents = pgTable(
  "security_events",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id"),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: varchar("user_agent", { length: 255 }),
    metadataJson: text("metadata_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userCreatedIdx: index("ix_security_events_user_created").on(table.userId, table.createdAt),
    typeCreatedIdx: index("ix_security_events_type_created").on(table.eventType, table.createdAt),
  }),
);

export const academicSubjects = pgTable(
  "academic_subjects",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    code: varchar("code", { length: 64 }),
    color: varchar("color", { length: 32 }).notNull().default("cyan"),
    targetMastery: integer("target_mastery").notNull().default(80),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userNameIdx: uniqueIndex("uq_academic_subjects_user_name").on(table.userId, table.name),
    userArchivedIdx: index("ix_academic_subjects_user_archived").on(table.userId, table.archived),
  }),
);

export const academicTopics = pgTable(
  "academic_topics",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    subjectId: integer("subject_id").notNull().references(() => academicSubjects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 180 }).notNull(),
    description: text("description"),
    masteryScore: integer("mastery_score").notNull().default(0),
    lastStudiedAt: timestamp("last_studied_at", { withTimezone: true }),
    nextReviewAt: timestamp("next_review_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    subjectNameIdx: uniqueIndex("uq_academic_topics_subject_name").on(table.subjectId, table.name),
    userReviewIdx: index("ix_academic_topics_user_review").on(table.userId, table.nextReviewAt),
    userMasteryIdx: index("ix_academic_topics_user_mastery").on(table.userId, table.masteryScore),
  }),
);

export const academicDeadlines = pgTable(
  "academic_deadlines",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    subjectId: integer("subject_id").references(() => academicSubjects.id, { onDelete: "set null" }),
    topicId: integer("topic_id").references(() => academicTopics.id, { onDelete: "set null" }),
    title: varchar("title", { length: 255 }).notNull(),
    type: varchar("type", { length: 32 }).notNull().default("assignment"),
    dueDate: date("due_date").notNull(),
    estimatedMinutes: integer("estimated_minutes").notNull().default(60),
    weight: integer("weight").notNull().default(1),
    status: varchar("status", { length: 32 }).notNull().default("open"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userStatusDueIdx: index("ix_academic_deadlines_user_status_due").on(table.userId, table.status, table.dueDate),
    subjectDueIdx: index("ix_academic_deadlines_subject_due").on(table.subjectId, table.dueDate),
  }),
);

export const notes = pgTable(
  "notes",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    subjectId: integer("subject_id").references(() => academicSubjects.id, { onDelete: "set null" }),
    topicId: integer("topic_id").references(() => academicTopics.id, { onDelete: "set null" }),
    title: varchar("title", { length: 255 }).notNull(),
    content: text("content").notNull(),
    subject: varchar("subject", { length: 128 }),
    tags: varchar("tags", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    isPublic: boolean("is_public").notNull().default(false),
    isFavorite: boolean("is_favorite").notNull().default(false),
    isArchived: boolean("is_archived").notNull().default(false),
    isPinned: boolean("is_pinned").notNull().default(false),
    likes: integer("likes").notNull().default(0),
  },
  (table) => ({
    userCreatedIdx: index("ix_notes_user_created").on(table.userId, table.createdAt),
    userArchivedPinnedIdx: index("ix_notes_user_archived_pinned").on(table.userId, table.isArchived, table.isPinned),
    publicLikesIdx: index("ix_notes_public_likes").on(table.isPublic, table.likes),
  }),
);

export const studyMaterials = pgTable(
  "study_materials",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    subjectId: integer("subject_id").references(() => academicSubjects.id, { onDelete: "set null" }),
    topicId: integer("topic_id").references(() => academicTopics.id, { onDelete: "set null" }),
    title: varchar("title", { length: 255 }).notNull(),
    subject: varchar("subject", { length: 128 }),
    originalFilename: varchar("original_filename", { length: 255 }).notNull(),
    storedFilename: varchar("stored_filename", { length: 255 }).notNull(),
    storagePath: text("storage_path").notNull(),
    mimeType: varchar("mime_type", { length: 128 }).notNull(),
    fileSizeBytes: integer("file_size_bytes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userCreatedIdx: index("ix_study_materials_user_created").on(table.userId, table.createdAt),
    userSubjectIdx: index("ix_study_materials_user_subject").on(table.userId, table.subject),
  }),
);

export const tasks = pgTable(
  "tasks",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    subjectId: integer("subject_id").references(() => academicSubjects.id, { onDelete: "set null" }),
    topicId: integer("topic_id").references(() => academicTopics.id, { onDelete: "set null" }),
    task: text("task"),
    subject: varchar("subject", { length: 128 }),
    priority: varchar("priority", { length: 32 }).notNull().default("medium"),
    dueDate: date("due_date"),
    reminderAt: timestamp("reminder_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completed: boolean("completed").notNull().default(false),
    archived: boolean("archived").notNull().default(false),
  },
  (table) => ({
    userCompletedDueIdx: index("ix_tasks_user_completed_due").on(table.userId, table.completed, table.dueDate),
    userArchivedPriorityIdx: index("ix_tasks_user_archived_priority").on(table.userId, table.archived, table.priority),
  }),
);

export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }),
    eventDate: date("event_date"),
    notes: text("notes"),
  },
  (table) => ({
    userDateIdx: index("ix_events_user_date").on(table.userId, table.eventDate),
  }),
);

export const studySessions = pgTable(
  "study_sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    subjectId: integer("subject_id").references(() => academicSubjects.id, { onDelete: "set null" }),
    topicId: integer("topic_id").references(() => academicTopics.id, { onDelete: "set null" }),
    durationMinutes: integer("duration_minutes").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (table) => ({
    userStartedIdx: index("ix_study_sessions_user_started").on(table.userId, table.startedAt),
  }),
);

export const flashcards = pgTable(
  "flashcards",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    subjectId: integer("subject_id").references(() => academicSubjects.id, { onDelete: "set null" }),
    topicId: integer("topic_id").references(() => academicTopics.id, { onDelete: "set null" }),
    title: varchar("title", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    isPublic: boolean("is_public").notNull().default(false),
  },
  (table) => ({
    userCreatedIdx: index("ix_flashcards_user_created").on(table.userId, table.createdAt),
    publicIdIdx: index("ix_flashcards_public_id").on(table.isPublic, table.id),
  }),
);

export const flashcardCards = pgTable("flashcard_cards", {
  id: serial("id").primaryKey(),
  flashcardId: integer("flashcard_id").notNull().references(() => flashcards.id, { onDelete: "cascade" }),
  front: text("front").notNull(),
  back: text("back").notNull(),
});

export const groups = pgTable(
  "groups",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description").notNull(),
    createdBy: integer("created_by").notNull().references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    memberCount: integer("member_count").notNull().default(0),
  },
  (table) => ({
    memberCountIdx: index("ix_groups_member_count").on(table.memberCount),
  }),
);

export const groupMembers = pgTable(
  "group_members",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueMemberIdx: uniqueIndex("uq_group_members_group_user").on(table.groupId, table.userId),
    userIdx: index("ix_group_members_user").on(table.userId),
  }),
);

export const posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    groupId: integer("group_id").references(() => groups.id, { onDelete: "cascade" }),
    content: text("content"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    createdIdx: index("ix_posts_created").on(table.createdAt),
    userCreatedIdx: index("ix_posts_user_created").on(table.userId, table.createdAt),
  }),
);

export const comments = pgTable(
  "comments",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    postId: integer("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    content: text("content"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    postCreatedIdx: index("ix_comments_post_created").on(table.postId, table.createdAt),
  }),
);

export const likes = pgTable(
  "likes",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    noteId: integer("note_id").notNull().references(() => notes.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueLikeIdx: uniqueIndex("uq_likes_user_note").on(table.userId, table.noteId),
    noteIdx: index("ix_likes_note").on(table.noteId),
  }),
);

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }),
    message: text("message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    isRead: boolean("is_read").notNull().default(false),
  },
  (table) => ({
    userReadCreatedIdx: index("ix_notifications_user_read_created").on(table.userId, table.isRead, table.createdAt),
  }),
);

export const achievements = pgTable(
  "achievements",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }),
    description: text("description"),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }),
  },
  (table) => ({
    userUnlockedIdx: index("ix_achievements_user_unlocked").on(table.userId, table.unlockedAt),
  }),
);

export const userRelations = relations(users, ({ one, many }) => ({
  profile: one(userProfiles, {
    fields: [users.id],
    references: [userProfiles.userId],
  }),
  settings: one(userSettings, {
    fields: [users.id],
    references: [userSettings.userId],
  }),
  sessions: many(userSessions),
  integrationTokens: many(integrationTokens),
  notes: many(notes),
  academicSubjects: many(academicSubjects),
  academicTopics: many(academicTopics),
  academicDeadlines: many(academicDeadlines),
  studyMaterials: many(studyMaterials),
  tasks: many(tasks),
  events: many(events),
  studySessions: many(studySessions),
  flashcards: many(flashcards),
  createdGroups: many(groups),
  groupMemberships: many(groupMembers),
  posts: many(posts),
  comments: many(comments),
  noteLikes: many(likes),
  notifications: many(notifications),
  achievements: many(achievements),
}));

export const userSessionRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id],
  }),
}));

export const userProfileRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, {
    fields: [userProfiles.userId],
    references: [users.id],
  }),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, {
    fields: [userSettings.userId],
    references: [users.id],
  }),
}));

export const academicSubjectRelations = relations(academicSubjects, ({ one, many }) => ({
  user: one(users, {
    fields: [academicSubjects.userId],
    references: [users.id],
  }),
  topics: many(academicTopics),
  deadlines: many(academicDeadlines),
  notes: many(notes),
  studyMaterials: many(studyMaterials),
  tasks: many(tasks),
  studySessions: many(studySessions),
  flashcards: many(flashcards),
}));

export const academicTopicRelations = relations(academicTopics, ({ one, many }) => ({
  user: one(users, {
    fields: [academicTopics.userId],
    references: [users.id],
  }),
  subject: one(academicSubjects, {
    fields: [academicTopics.subjectId],
    references: [academicSubjects.id],
  }),
  deadlines: many(academicDeadlines),
  notes: many(notes),
  studyMaterials: many(studyMaterials),
  tasks: many(tasks),
  studySessions: many(studySessions),
  flashcards: many(flashcards),
}));

export const academicDeadlineRelations = relations(academicDeadlines, ({ one }) => ({
  user: one(users, {
    fields: [academicDeadlines.userId],
    references: [users.id],
  }),
  subject: one(academicSubjects, {
    fields: [academicDeadlines.subjectId],
    references: [academicSubjects.id],
  }),
  topic: one(academicTopics, {
    fields: [academicDeadlines.topicId],
    references: [academicTopics.id],
  }),
}));

export const noteRelations = relations(notes, ({ one, many }) => ({
  user: one(users, {
    fields: [notes.userId],
    references: [users.id],
  }),
  academicSubject: one(academicSubjects, {
    fields: [notes.subjectId],
    references: [academicSubjects.id],
  }),
  academicTopic: one(academicTopics, {
    fields: [notes.topicId],
    references: [academicTopics.id],
  }),
  likedBy: many(likes),
}));

export const studyMaterialRelations = relations(studyMaterials, ({ one }) => ({
  user: one(users, {
    fields: [studyMaterials.userId],
    references: [users.id],
  }),
  academicSubject: one(academicSubjects, {
    fields: [studyMaterials.subjectId],
    references: [academicSubjects.id],
  }),
  academicTopic: one(academicTopics, {
    fields: [studyMaterials.topicId],
    references: [academicTopics.id],
  }),
}));

export const taskRelations = relations(tasks, ({ one }) => ({
  user: one(users, {
    fields: [tasks.userId],
    references: [users.id],
  }),
  academicSubject: one(academicSubjects, {
    fields: [tasks.subjectId],
    references: [academicSubjects.id],
  }),
  academicTopic: one(academicTopics, {
    fields: [tasks.topicId],
    references: [academicTopics.id],
  }),
}));

export const eventRelations = relations(events, ({ one }) => ({
  user: one(users, {
    fields: [events.userId],
    references: [users.id],
  }),
}));

export const studySessionRelations = relations(studySessions, ({ one }) => ({
  user: one(users, {
    fields: [studySessions.userId],
    references: [users.id],
  }),
  academicSubject: one(academicSubjects, {
    fields: [studySessions.subjectId],
    references: [academicSubjects.id],
  }),
  academicTopic: one(academicTopics, {
    fields: [studySessions.topicId],
    references: [academicTopics.id],
  }),
}));

export const flashcardRelations = relations(flashcards, ({ one, many }) => ({
  user: one(users, {
    fields: [flashcards.userId],
    references: [users.id],
  }),
  academicSubject: one(academicSubjects, {
    fields: [flashcards.subjectId],
    references: [academicSubjects.id],
  }),
  academicTopic: one(academicTopics, {
    fields: [flashcards.topicId],
    references: [academicTopics.id],
  }),
  cards: many(flashcardCards),
}));

export const flashcardCardRelations = relations(flashcardCards, ({ one }) => ({
  flashcard: one(flashcards, {
    fields: [flashcardCards.flashcardId],
    references: [flashcards.id],
  }),
}));

export const groupRelations = relations(groups, ({ one, many }) => ({
  creator: one(users, {
    fields: [groups.createdBy],
    references: [users.id],
  }),
  members: many(groupMembers),
  posts: many(posts),
}));

export const postRelations = relations(posts, ({ one, many }) => ({
  user: one(users, {
    fields: [posts.userId],
    references: [users.id],
  }),
  group: one(groups, {
    fields: [posts.groupId],
    references: [groups.id],
  }),
  comments: many(comments),
}));
