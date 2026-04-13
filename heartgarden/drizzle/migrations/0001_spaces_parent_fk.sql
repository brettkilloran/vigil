DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'spaces_parent_space_id_spaces_id_fk'
      AND table_name = 'spaces'
  ) THEN
    ALTER TABLE "spaces"
      DROP CONSTRAINT "spaces_parent_space_id_spaces_id_fk";
  END IF;
END $$;

UPDATE "spaces" AS s
SET "parent_space_id" = NULL
WHERE s."parent_space_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "spaces" AS p
    WHERE p."id" = s."parent_space_id"
  );

ALTER TABLE "spaces"
  ADD CONSTRAINT "spaces_parent_space_id_spaces_id_fk"
  FOREIGN KEY ("parent_space_id")
  REFERENCES "spaces"("id")
  ON DELETE SET NULL;
