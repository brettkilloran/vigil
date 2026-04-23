-- Add append-only progress timeline events for lore import jobs.
alter table "lore_import_jobs"
  add column if not exists "progress_events" jsonb default '[]'::jsonb;

