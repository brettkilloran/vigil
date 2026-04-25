-- REVIEW_2026-04-25_1835 H5: `searchItemsFuzzy` runs `similarity()` on `content_text`
-- and `search_blob` to recall typo-tolerant hits. The existing `items_title_trgm_idx`
-- (migration 0002) covered title only, so body / blob similarity was a sequential scan
-- on every keystroke at scale.
--
-- pg_trgm is already installed by 0002. These two GIN indexes let the planner use a
-- trigram lookup before invoking `similarity()` for ranking, restoring sub-100ms recall
-- at thousands of items.

CREATE INDEX IF NOT EXISTS "items_content_text_trgm_idx"
  ON "items"
  USING gin ("content_text" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "items_search_blob_trgm_idx"
  ON "items"
  USING gin ("search_blob" gin_trgm_ops);
