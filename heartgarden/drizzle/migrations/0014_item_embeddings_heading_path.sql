ALTER TABLE "item_embeddings"
ADD COLUMN IF NOT EXISTS "heading_path" text;
