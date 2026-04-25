-- REVIEW_2026-04-25_1835 H18: `nextZIndexForSpace` runs
--   SELECT max(z_index) FROM items WHERE space_id = $1
-- on every item create. Without a `(space_id, z_index DESC)` index this is O(N) over
-- items in the space; in burst-create scenarios (lore import, brane reparent) every
-- new row pays the cost.
--
-- We already have a `(space_id, updated_at DESC)` index from 0008; this is the
-- max-z-index analogue for stacking-layer assignment.

CREATE INDEX IF NOT EXISTS "items_space_zindex_desc_idx"
  ON "items" ("space_id", "z_index" DESC);
