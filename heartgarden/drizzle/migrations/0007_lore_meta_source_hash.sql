-- Skip redundant Anthropic lore-meta calls when title + content_text prompt is unchanged.

ALTER TABLE "items"
  ADD COLUMN IF NOT EXISTS "lore_meta_source_hash" varchar(64);
