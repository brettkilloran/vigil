CREATE TABLE IF NOT EXISTS "import_review_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "import_batch_id" uuid NOT NULL,
  "space_id" uuid REFERENCES "spaces"("id") ON DELETE CASCADE,
  "status" varchar(32) DEFAULT 'pending' NOT NULL,
  "kind" varchar(64) DEFAULT 'contradiction' NOT NULL,
  "payload" jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "import_review_items_batch_idx"
  ON "import_review_items" ("import_batch_id");

CREATE INDEX IF NOT EXISTS "import_review_items_space_idx"
  ON "import_review_items" ("space_id");
