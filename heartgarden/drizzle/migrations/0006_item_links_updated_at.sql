-- Bump row on link edits so cheap revision queries detect PATCH/DELETE, not only INSERT.
ALTER TABLE "item_links" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();
UPDATE "item_links" SET "updated_at" = COALESCE("created_at", now()) WHERE "updated_at" IS NULL;
ALTER TABLE "item_links" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE "item_links" ALTER COLUMN "updated_at" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "item_links_source_item_id_idx" ON "item_links" ("source_item_id");
