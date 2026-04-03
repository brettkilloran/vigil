import {
  customType,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const vector1536 = customType<{ data: number[] }>({
  dataType() {
    return "vector(1536)";
  },
});

export const spaces = pgTable("spaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  parentSpaceId: uuid("parent_space_id"),
  name: varchar("name", { length: 255 }).notNull(),
  color: varchar("color", { length: 64 }),
  sortOrder: integer("sort_order").notNull().default(0),
  /** Camera only: { x, y, zoom }. Legacy rows may hold tldraw snapshot until migrated. */
  canvasState: jsonb("canvas_state").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const items = pgTable("items", {
  id: uuid("id").defaultRandom().primaryKey(),
  spaceId: uuid("space_id")
    .notNull()
    .references(() => spaces.id, { onDelete: "cascade" }),
  itemType: varchar("item_type", { length: 64 }).notNull(),

  x: doublePrecision("x").notNull().default(0),
  y: doublePrecision("y").notNull().default(0),
  width: doublePrecision("width").notNull().default(280),
  height: doublePrecision("height").notNull().default(200),
  zIndex: integer("z_index").notNull().default(0),

  title: varchar("title", { length: 255 }).notNull().default(""),
  contentText: text("content_text").notNull().default(""),
  contentJson: jsonb("content_json").$type<Record<string, unknown> | null>(),

  imageUrl: text("image_url"),
  imageMeta: jsonb("image_meta").$type<Record<string, unknown> | null>(),

  color: varchar("color", { length: 64 }),

  entityType: varchar("entity_type", { length: 64 }),
  entityMeta: jsonb("entity_meta").$type<Record<string, unknown> | null>(),

  stackId: uuid("stack_id"),
  stackOrder: integer("stack_order"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const itemLinks = pgTable(
  "item_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceItemId: uuid("source_item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    targetItemId: uuid("target_item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    linkType: varchar("link_type", { length: 64 }).notNull().default("reference"),
    label: text("label"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [unique("item_links_source_target_uidx").on(t.sourceItemId, t.targetItemId)],
);

export const itemEmbeddings = pgTable("item_embeddings", {
  id: uuid("id").defaultRandom().primaryKey(),
  itemId: uuid("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  embedding: vector1536("embedding"),
  chunkText: text("chunk_text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
