-- Import-mode context captured at queue time (granularity + org mode + optional hint text).

ALTER TABLE "lore_import_jobs"
  ADD COLUMN IF NOT EXISTS "user_context" jsonb;
