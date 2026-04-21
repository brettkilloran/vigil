-- One row per browser tab (`client_id`) for soft-multiplayer presence;
-- replaces legacy `space_presence` composite-key table. Matches `canvasPresence`
-- in `src/db/schema.ts`. `drizzle-kit push --force` also creates this, but
-- having a SQL file makes the table explicit in one-shot / repair workflows.

CREATE TABLE IF NOT EXISTS "canvas_presence" (
  "client_id" uuid PRIMARY KEY,
  "active_space_id" uuid NOT NULL,
  "camera" jsonb NOT NULL,
  "pointer" jsonb,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'canvas_presence_active_space_id_spaces_id_fk'
      AND table_name = 'canvas_presence'
  ) THEN
    ALTER TABLE "canvas_presence"
      ADD CONSTRAINT "canvas_presence_active_space_id_spaces_id_fk"
      FOREIGN KEY ("active_space_id")
      REFERENCES "spaces"("id")
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "canvas_presence_active_space_id_idx"
  ON "canvas_presence" ("active_space_id");

CREATE INDEX IF NOT EXISTS "canvas_presence_updated_at_idx"
  ON "canvas_presence" ("updated_at");
