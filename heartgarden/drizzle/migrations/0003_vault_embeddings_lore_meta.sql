-- Vault index: lore meta on items + chunk embedding metadata (run after drizzle push aligns columns, or apply manually).

ALTER TABLE "items"
  ADD COLUMN IF NOT EXISTS "lore_summary" text;
ALTER TABLE "items"
  ADD COLUMN IF NOT EXISTS "lore_aliases" jsonb;
ALTER TABLE "items"
  ADD COLUMN IF NOT EXISTS "lore_indexed_at" timestamptz;

ALTER TABLE "item_embeddings"
  ADD COLUMN IF NOT EXISTS "space_id" uuid REFERENCES "spaces"("id") ON DELETE CASCADE;
ALTER TABLE "item_embeddings"
  ADD COLUMN IF NOT EXISTS "chunk_index" integer NOT NULL DEFAULT 0;
ALTER TABLE "item_embeddings"
  ADD COLUMN IF NOT EXISTS "content_hash" varchar(64) NOT NULL DEFAULT '';
ALTER TABLE "item_embeddings"
  ADD COLUMN IF NOT EXISTS "source_updated_at" timestamptz NOT NULL DEFAULT now();

UPDATE "item_embeddings" AS e
SET
  "space_id" = i."space_id",
  "source_updated_at" = i."updated_at"
FROM "items" AS i
WHERE e."item_id" = i."id"
  AND e."space_id" IS NULL;

DELETE FROM "item_embeddings" WHERE "space_id" IS NULL;

-- If your DB still has null space_id rows with missing items, they were removed above.

ALTER TABLE "item_embeddings" ALTER COLUMN "space_id" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "item_embeddings_space_id_idx"
  ON "item_embeddings" ("space_id");
CREATE INDEX IF NOT EXISTS "item_embeddings_item_id_idx"
  ON "item_embeddings" ("item_id");

-- Approximate nearest neighbor (cosine). Requires pgvector; skip if extension missing.
CREATE INDEX IF NOT EXISTS "item_embeddings_embedding_hnsw_idx"
  ON "item_embeddings"
  USING hnsw ("embedding" vector_cosine_ops);
