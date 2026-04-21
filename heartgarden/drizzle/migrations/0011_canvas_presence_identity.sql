ALTER TABLE canvas_presence
  ADD COLUMN IF NOT EXISTS display_name varchar(32);

ALTER TABLE canvas_presence
  ADD COLUMN IF NOT EXISTS sigil varchar(16);
