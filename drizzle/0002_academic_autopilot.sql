CREATE TABLE "academic_subjects" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" varchar(160) NOT NULL,
	"code" varchar(64),
	"color" varchar(32) DEFAULT 'cyan' NOT NULL,
	"target_mastery" integer DEFAULT 80 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academic_topics" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"subject_id" integer NOT NULL,
	"name" varchar(180) NOT NULL,
	"description" text,
	"mastery_score" integer DEFAULT 0 NOT NULL,
	"last_studied_at" timestamp with time zone,
	"next_review_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academic_deadlines" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"subject_id" integer,
	"topic_id" integer,
	"title" varchar(255) NOT NULL,
	"type" varchar(32) DEFAULT 'assignment' NOT NULL,
	"due_date" date NOT NULL,
	"estimated_minutes" integer DEFAULT 60 NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	"status" varchar(32) DEFAULT 'open' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "subject_id" integer;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "topic_id" integer;--> statement-breakpoint
ALTER TABLE "study_materials" ADD COLUMN "subject_id" integer;--> statement-breakpoint
ALTER TABLE "study_materials" ADD COLUMN "topic_id" integer;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "subject_id" integer;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "topic_id" integer;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD COLUMN "subject_id" integer;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD COLUMN "topic_id" integer;--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN "subject_id" integer;--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN "topic_id" integer;--> statement-breakpoint
ALTER TABLE "academic_subjects" ADD CONSTRAINT "academic_subjects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_topics" ADD CONSTRAINT "academic_topics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_topics" ADD CONSTRAINT "academic_topics_subject_id_academic_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."academic_subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_deadlines" ADD CONSTRAINT "academic_deadlines_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_deadlines" ADD CONSTRAINT "academic_deadlines_subject_id_academic_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."academic_subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_deadlines" ADD CONSTRAINT "academic_deadlines_topic_id_academic_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."academic_topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_subject_id_academic_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."academic_subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_topic_id_academic_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."academic_topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_materials" ADD CONSTRAINT "study_materials_subject_id_academic_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."academic_subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_materials" ADD CONSTRAINT "study_materials_topic_id_academic_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."academic_topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_subject_id_academic_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."academic_subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_topic_id_academic_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."academic_topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_subject_id_academic_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."academic_subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_topic_id_academic_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."academic_topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_subject_id_academic_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."academic_subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_topic_id_academic_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."academic_topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_academic_subjects_user_name" ON "academic_subjects" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "ix_academic_subjects_user_archived" ON "academic_subjects" USING btree ("user_id","archived");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_academic_topics_subject_name" ON "academic_topics" USING btree ("subject_id","name");--> statement-breakpoint
CREATE INDEX "ix_academic_topics_user_review" ON "academic_topics" USING btree ("user_id","next_review_at");--> statement-breakpoint
CREATE INDEX "ix_academic_topics_user_mastery" ON "academic_topics" USING btree ("user_id","mastery_score");--> statement-breakpoint
CREATE INDEX "ix_academic_deadlines_user_status_due" ON "academic_deadlines" USING btree ("user_id","status","due_date");--> statement-breakpoint
CREATE INDEX "ix_academic_deadlines_subject_due" ON "academic_deadlines" USING btree ("subject_id","due_date");
