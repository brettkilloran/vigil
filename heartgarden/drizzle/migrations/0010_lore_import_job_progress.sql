-- Durable progress fields for smart import jobs.
-- Keeps import progress visible across refreshes/reconnects while the after() worker runs.

ALTER TABLE "lore_import_jobs"
  ADD COLUMN IF NOT EXISTS "progress_phase" varchar(64);

ALTER TABLE "lore_import_jobs"
  ADD COLUMN IF NOT EXISTS "progress_step" integer;

ALTER TABLE "lore_import_jobs"
  ADD COLUMN IF NOT EXISTS "progress_total" integer;

ALTER TABLE "lore_import_jobs"
  ADD COLUMN IF NOT EXISTS "progress_message" text;

ALTER TABLE "lore_import_jobs"
  ADD COLUMN IF NOT EXISTS "progress_meta" jsonb;

ALTER TABLE "lore_import_jobs"
  ADD COLUMN IF NOT EXISTS "last_progress_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "lore_import_jobs_last_progress_idx"
  ON "lore_import_jobs" ("last_progress_at");
