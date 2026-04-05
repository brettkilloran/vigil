CREATE TABLE IF NOT EXISTS "lore_import_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "space_id" uuid NOT NULL REFERENCES "spaces"("id") ON DELETE CASCADE,
  "import_batch_id" uuid NOT NULL,
  "status" varchar(32) DEFAULT 'queued' NOT NULL,
  "source_text" text NOT NULL,
  "file_name" varchar(512),
  "plan" jsonb,
  "error" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "lore_import_jobs_space_idx" ON "lore_import_jobs" ("space_id");
CREATE INDEX IF NOT EXISTS "lore_import_jobs_status_idx" ON "lore_import_jobs" ("status");
