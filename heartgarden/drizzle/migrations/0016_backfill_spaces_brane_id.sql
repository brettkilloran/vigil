-- REVIEW_2026-04-25_1730 M4 (warning, after-the-fact):
--
-- The `demo_roots` CTE below uses a name heuristic — `lower(s.name) LIKE 'demo%'`.
-- That means a real GM workspace whose space name happens to start with "demo"
-- (e.g. "demo-tarot-flow", "demo run 2024") was silently moved into the demo
-- brane on the first run of this migration. There is no marker column, so we
-- cannot retroactively distinguish "intentional demo seed root" from
-- "happens-to-be-named-demo-foo".
--
-- DO NOT add a corrective migration that re-shifts already-applied data:
-- by the time you read this on a deployed system, links and entity_mentions
-- have been written assuming the current `brane_id` assignment, so moving
-- spaces back to GM would orphan that data and silently break Alt-hover and
-- the graph panel for those workspaces.
--
-- A safer recovery path is captured in
-- `.cursor/plans/demo-brane-marker-column.plan.md`: introduce an explicit
-- `branes.is_demo_seed` flag (or a known UUID list) and have the demo seed
-- mark itself, then provide an opt-in admin tool to reclassify
-- false-positive demo spaces with a transactional link/mention re-scope.

INSERT INTO "branes" ("name", "brane_type")
VALUES
  ('GM Brane', 'gm'),
  ('Player Brane', 'player'),
  ('Demo Brane', 'demo')
ON CONFLICT ("brane_type") DO NOTHING;

WITH player_roots AS (
  SELECT s.id
  FROM "spaces" s
  WHERE lower(s.name) = '__heartgarden_player_root__'
),
player_space_tree AS (
  SELECT id FROM player_roots
  UNION ALL
  SELECT s.id
  FROM "spaces" s
  JOIN player_space_tree pst ON s.parent_space_id = pst.id
),
demo_roots AS (
  SELECT s.id
  FROM "spaces" s
  WHERE lower(s.name) LIKE 'demo%'
),
demo_space_tree AS (
  SELECT id FROM demo_roots
  UNION ALL
  SELECT s.id
  FROM "spaces" s
  JOIN demo_space_tree dst ON s.parent_space_id = dst.id
),
player_brane AS (
  SELECT id FROM "branes" WHERE brane_type = 'player' LIMIT 1
),
demo_brane AS (
  SELECT id FROM "branes" WHERE brane_type = 'demo' LIMIT 1
),
gm_brane AS (
  SELECT id FROM "branes" WHERE brane_type = 'gm' LIMIT 1
)
UPDATE "spaces" s
SET "brane_id" = CASE
  WHEN s.id IN (SELECT id FROM player_space_tree) THEN (SELECT id FROM player_brane)
  WHEN s.id IN (SELECT id FROM demo_space_tree) THEN (SELECT id FROM demo_brane)
  ELSE (SELECT id FROM gm_brane)
END
WHERE s.brane_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "spaces" WHERE "brane_id" IS NULL) THEN
    RAISE EXCEPTION 'brane_id backfill left null values in spaces';
  END IF;
END $$;

ALTER TABLE "spaces"
  ALTER COLUMN "brane_id" SET NOT NULL;
