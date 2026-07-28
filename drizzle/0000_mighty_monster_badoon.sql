CREATE TABLE "achievements" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" varchar(255),
	"description" text,
	"unlocked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth_rate_limits" (
	"id" serial PRIMARY KEY NOT NULL,
	"action" varchar(64) NOT NULL,
	"identifier_hash" varchar(64) NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"post_id" integer NOT NULL,
	"content" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" varchar(255),
	"event_date" date,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "flashcard_cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"flashcard_id" integer NOT NULL,
	"front" text NOT NULL,
	"back" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flashcards" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"member_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider" varchar(64) NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text,
	"scope" text,
	"metadata" jsonb,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"note_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"subject" varchar(128),
	"tags" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"is_public" boolean DEFAULT false NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" varchar(255),
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"group_id" integer,
	"content" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"event_type" varchar(64) NOT NULL,
	"ip_address" varchar(64),
	"user_agent" varchar(255),
	"metadata_json" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"duration_minutes" integer NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"task" text,
	"subject" varchar(128),
	"priority" varchar(32) DEFAULT 'medium' NOT NULL,
	"due_date" date,
	"reminder_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"archived" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"display_name" varchar(128),
	"bio" text,
	"profile_pic" varchar(255),
	"course" varchar(128),
	"institution" varchar(255),
	"education_level" varchar(128),
	"field_of_study" varchar(128),
	"country" varchar(128),
	"profile_visibility" varchar(32) DEFAULT 'private' NOT NULL,
	"show_email" boolean DEFAULT false NOT NULL,
	"show_academic_profile" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"ip_address" varchar(64),
	"user_agent" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"theme" varchar(32) DEFAULT 'dark' NOT NULL,
	"language" varchar(16) DEFAULT 'en' NOT NULL,
	"timezone" varchar(64) DEFAULT 'UTC' NOT NULL,
	"reduced_motion" boolean DEFAULT false NOT NULL,
	"high_contrast" boolean DEFAULT false NOT NULL,
	"email_notifications" boolean DEFAULT true NOT NULL,
	"study_reminders" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(128) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"email_verification_token_hash" varchar(64),
	"email_verification_sent_at" timestamp with time zone,
	"pending_email" varchar(255),
	"pending_email_token_hash" varchar(64),
	"pending_email_sent_at" timestamp with time zone,
	"password_reset_token_hash" varchar(64),
	"password_reset_sent_at" timestamp with time zone,
	"course" varchar(128),
	"bio" text,
	"profile_pic" varchar(255),
	"streak_days" integer DEFAULT 0 NOT NULL,
	"total_hours" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcard_cards" ADD CONSTRAINT "flashcard_cards_flashcard_id_flashcards_id_fk" FOREIGN KEY ("flashcard_id") REFERENCES "public"."flashcards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_tokens" ADD CONSTRAINT "integration_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_achievements_user_unlocked" ON "achievements" USING btree ("user_id","unlocked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_auth_rate_limits_action_identifier_window" ON "auth_rate_limits" USING btree ("action","identifier_hash","window_start");--> statement-breakpoint
CREATE INDEX "ix_auth_rate_limits_action_updated" ON "auth_rate_limits" USING btree ("action","updated_at");--> statement-breakpoint
CREATE INDEX "ix_comments_post_created" ON "comments" USING btree ("post_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_events_user_date" ON "events" USING btree ("user_id","event_date");--> statement-breakpoint
CREATE INDEX "ix_flashcards_user_created" ON "flashcards" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_flashcards_public_id" ON "flashcards" USING btree ("is_public","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_group_members_group_user" ON "group_members" USING btree ("group_id","user_id");--> statement-breakpoint
CREATE INDEX "ix_group_members_user" ON "group_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_groups_member_count" ON "groups" USING btree ("member_count");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_integration_tokens_user_provider" ON "integration_tokens" USING btree ("user_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_likes_user_note" ON "likes" USING btree ("user_id","note_id");--> statement-breakpoint
CREATE INDEX "ix_likes_note" ON "likes" USING btree ("note_id");--> statement-breakpoint
CREATE INDEX "ix_notes_user_created" ON "notes" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_notes_user_archived_pinned" ON "notes" USING btree ("user_id","is_archived","is_pinned");--> statement-breakpoint
CREATE INDEX "ix_notes_public_likes" ON "notes" USING btree ("is_public","likes");--> statement-breakpoint
CREATE INDEX "ix_notifications_user_read_created" ON "notifications" USING btree ("user_id","is_read","created_at");--> statement-breakpoint
CREATE INDEX "ix_posts_created" ON "posts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ix_posts_user_created" ON "posts" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_security_events_user_created" ON "security_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_security_events_type_created" ON "security_events" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE INDEX "ix_study_sessions_user_started" ON "study_sessions" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "ix_tasks_user_completed_due" ON "tasks" USING btree ("user_id","completed","due_date");--> statement-breakpoint
CREATE INDEX "ix_tasks_user_archived_priority" ON "tasks" USING btree ("user_id","archived","priority");--> statement-breakpoint
CREATE INDEX "ix_user_profiles_visibility" ON "user_profiles" USING btree ("profile_visibility");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_user_sessions_token_hash" ON "user_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "ix_user_sessions_user_expires" ON "user_sessions" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_users_username" ON "users" USING btree ("username");