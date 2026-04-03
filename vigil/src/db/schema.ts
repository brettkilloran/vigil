import { customType } from "drizzle-orm/pg-core";
import {
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

// pgvector: https://github.com/pgvector/pgvector
const vector1536 = customType<{ data: number[] }>({
  dataType() {
    return "vector(1536)";
  },
});

// Full-text search: tsvector
const tsvectorType = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  googleId: varchar("google_id", { length: 255 }).unique(),
  email: varchar("email", { length: 255 }),
  name: varchar("name", { length: 255 }),
  avatarUrl: varchar("avatar_url", { length: 1024 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const spaces = pgTable("spaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  parentSpaceId: uuid("parent_space_id"),
  name: varchar("name", { length: 255 }).notNull(),
  color: varchar("color", { length: 64 }),
  canvasState: jsonb("canvas_state").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const items = pgTable(
  "items",
  {
  id: uuid("id").defaultRandom().primaryKey(),
  spaceId: uuid("space_id")
    .notNull()
    .references(() => spaces.id),
  itemType: varchar("item_type", { length: 64 }).notNull(), // note | sticky | image | checklist | webclip

  /** Stable id from tldraw (`shape:…`) for canvas ↔ row sync */
  sourceShapeId: varchar("source_shape_id", { length: 128 }),

  x: doublePrecision("x").notNull().default(0),
  y: doublePrecision("y").notNull().default(0),
  width: doublePrecision("width").notNull().default(0),
  height: doublePrecision("height").notNull().default(0),
  zIndex: integer("z_index").notNull().default(0),

  title: varchar("title", { length: 255 }).notNull().default(""),
  contentText: text("content_text").notNull().default(""),
  contentJson: jsonb("content_json").$type<Record<string, unknown>>(),

  imageUrl: text("image_url"),
  imageMeta: jsonb("image_meta").$type<Record<string, unknown>>(),

  color: varchar("color", { length: 64 }),

  entityType: varchar("entity_type", { length: 64 }),
  entityMeta: jsonb("entity_meta").$type<Record<string, unknown>>(),

  // Generated in SQL (tsvector) in later phases.
  searchVector: tsvectorType("search_vector"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    unique("items_space_source_shape_uidx").on(t.spaceId, t.sourceShapeId),
  ],
);

export const itemLinks = pgTable(
  "item_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceItemId: uuid("source_item_id")
      .notNull()
      .references(() => items.id),
    targetItemId: uuid("target_item_id")
      .notNull()
      .references(() => items.id),
    linkType: varchar("link_type", { length: 64 }).notNull(), // reference | parent | related | contradicts
    label: text("label"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
);

export const itemEmbeddings = pgTable("item_embeddings", {
  id: uuid("id").defaultRandom().primaryKey(),
  itemId: uuid("item_id")
    .notNull()
    .references(() => items.id),
  embedding: vector1536("embedding"),
  chunkText: text("chunk_text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

