-- Speed delta sync: WHERE space_id IN (…) AND updated_at > $since ORDER BY updated_at
CREATE INDEX IF NOT EXISTS "items_space_id_updated_at_idx"
  ON "items" ("space_id", "updated_at");
