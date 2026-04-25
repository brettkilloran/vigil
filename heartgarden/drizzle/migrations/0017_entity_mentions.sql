CREATE TABLE IF NOT EXISTS "entity_mentions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "source_item_id" uuid NOT NULL REFERENCES "items"("id") ON DELETE CASCADE,
  "target_item_id" uuid NOT NULL REFERENCES "items"("id") ON DELETE CASCADE,
  "matched_term" text NOT NULL,
  "mention_count" integer NOT NULL DEFAULT 1,
  "snippet" text,
  "heading_path" text,
  "brane_id" uuid NOT NULL REFERENCES "branes"("id") ON DELETE CASCADE,
  "source_space_id" uuid NOT NULL REFERENCES "spaces"("id") ON DELETE CASCADE,
  "source_kind" varchar(16) NOT NULL DEFAULT 'term',
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  CONSTRAINT "entity_mentions_source_not_target_chk" CHECK ("source_item_id" <> "target_item_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "entity_mentions_source_target_term_kind_uidx"
  ON "entity_mentions" ("source_item_id", "target_item_id", "matched_term", "source_kind");
CREATE INDEX IF NOT EXISTS "entity_mentions_target_idx" ON "entity_mentions" ("target_item_id");
CREATE INDEX IF NOT EXISTS "entity_mentions_term_idx" ON "entity_mentions" ("matched_term");
CREATE INDEX IF NOT EXISTS "entity_mentions_brane_idx" ON "entity_mentions" ("brane_id");
CREATE INDEX IF NOT EXISTS "entity_mentions_source_space_idx" ON "entity_mentions" ("source_space_id");
