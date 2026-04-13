-- Optional Phase 4 performance: GIN index for keyword search (matches searchItemsFTS expression).
-- Run manually on Neon when the items table is large. CONCURRENTLY avoids long write locks.
CREATE INDEX CONCURRENTLY IF NOT EXISTS items_fts_gin
ON items
USING gin (
  to_tsvector(
    'english',
    coalesce(search_blob, '')
  )
);
