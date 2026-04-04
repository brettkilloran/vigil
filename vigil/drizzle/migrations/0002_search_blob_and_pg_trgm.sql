CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE "items"
  ADD COLUMN IF NOT EXISTS "search_blob" text NOT NULL DEFAULT '';

UPDATE "items"
SET "search_blob" = trim(regexp_replace(
  concat_ws(
    ' ',
    coalesce("title", ''),
    coalesce("content_text", ''),
    coalesce("entity_type", ''),
    coalesce("image_url", ''),
    coalesce("entity_meta"::text, ''),
    coalesce("image_meta"::text, ''),
    coalesce("content_json"::text, '')
  ),
  '\s+',
  ' ',
  'g'
))
WHERE coalesce("search_blob", '') = '';

CREATE INDEX IF NOT EXISTS "items_title_trgm_idx"
  ON "items"
  USING gin ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "items_search_blob_fts_idx"
  ON "items"
  USING gin (to_tsvector('english', coalesce("search_blob", '')));
