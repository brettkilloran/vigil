CREATE TABLE IF NOT EXISTS "space_graph_layout_cache" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "space_id" uuid NOT NULL,
  "graph_revision" varchar(255) NOT NULL,
  "layout_version" varchar(64) NOT NULL,
  "positions" jsonb NOT NULL,
  "node_count" integer DEFAULT 0 NOT NULL,
  "saved_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "space_graph_layout_cache_space_revision_layout_uidx"
    UNIQUE ("space_id", "graph_revision", "layout_version")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "space_graph_layout_cache"
   ADD CONSTRAINT "space_graph_layout_cache_space_id_spaces_id_fk"
   FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id")
   ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "space_graph_layout_cache_space_updated_at_idx"
  ON "space_graph_layout_cache" USING btree ("space_id","updated_at");
