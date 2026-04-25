CREATE TABLE IF NOT EXISTS "branes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(255) NOT NULL,
  "brane_type" varchar(32) NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "branes_brane_type_uidx" ON "branes" ("brane_type");

ALTER TABLE "spaces"
  ADD COLUMN IF NOT EXISTS "brane_id" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'spaces'
      AND constraint_name = 'spaces_brane_id_branes_id_fk'
  ) THEN
    ALTER TABLE "spaces"
      ADD CONSTRAINT "spaces_brane_id_branes_id_fk"
      FOREIGN KEY ("brane_id")
      REFERENCES "branes"("id")
      ON DELETE CASCADE;
  END IF;
END $$;
