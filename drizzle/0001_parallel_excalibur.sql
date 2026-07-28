CREATE TABLE "study_materials" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"subject" varchar(128),
	"original_filename" varchar(255) NOT NULL,
	"stored_filename" varchar(255) NOT NULL,
	"storage_path" text NOT NULL,
	"mime_type" varchar(128) NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "study_materials" ADD CONSTRAINT "study_materials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_study_materials_user_created" ON "study_materials" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_study_materials_user_subject" ON "study_materials" USING btree ("user_id","subject");