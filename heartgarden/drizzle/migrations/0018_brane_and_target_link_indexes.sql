-- REVIEW_2026-04-25_1730 M5: hot-path indexes that previous migrations missed.
-- spaces.brane_id is filtered by /api/graph/brane, /api/branes/[id]/vocabulary,
-- /api/mentions, and the brane-wide vocabulary builder.
-- item_links.target_item_id is filtered by /api/items/[itemId]/links and the
-- item-links revision query (`OR EXISTS (…) target_item_id` branch).

CREATE INDEX IF NOT EXISTS "spaces_brane_id_idx"
  ON "spaces" ("brane_id");

CREATE INDEX IF NOT EXISTS "item_links_target_item_id_idx"
  ON "item_links" ("target_item_id");
