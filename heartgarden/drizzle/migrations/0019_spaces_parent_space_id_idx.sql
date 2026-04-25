-- REVIEW_2026-04-25_1835 H4: subtree-walk hot path uses `spaces.parent_space_id` to find
-- children (player permission checks, presence subtree resolution, realtime invalidation).
-- Without this index every walk falls back to a sequential scan of `spaces`, which becomes
-- expensive once the workspace has hundreds of folders.

CREATE INDEX IF NOT EXISTS "spaces_parent_space_id_idx"
  ON "spaces" ("parent_space_id");
