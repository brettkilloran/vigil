import { sql } from "drizzle-orm";
import {
  check,
  customType,
  doublePrecision,
  foreignKey,
  index,
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

export const branes = pgTable(
  "branes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    braneType: varchar("brane_type", { length: 32 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [unique("branes_brane_type_uidx").on(table.braneType)],
);

export const spaces = pgTable(
  "spaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    braneId: uuid("brane_id"),
    parentSpaceId: uuid("parent_space_id"),
    name: varchar("name", { length: 255 }).notNull(),
    color: varchar("color", { length: 64 }),
    sortOrder: integer("sort_order").notNull().default(0),
    /** Camera only: { x, y, zoom }. Legacy rows may hold tldraw snapshot until migrated. */
    canvasState: jsonb("canvas_state").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.braneId],
      foreignColumns: [branes.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.parentSpaceId],
      foreignColumns: [table.id],
    }).onDelete("set null"),
    // REVIEW_2026-04-25_1730 M5: hot-path filter for /api/graph/brane,
    // /api/branes/[id]/vocabulary, /api/mentions, vocabulary builder.
    index("spaces_brane_id_idx").on(table.braneId),
  ],
);

/**
 * One row per browser tab (`client_id`). Replaces legacy `space_presence` composite key
 * so subtree presence queries do not duplicate peers after space switches.
 */
export const canvasPresence = pgTable("canvas_presence", {
  clientId: uuid("client_id").primaryKey(),
  activeSpaceId: uuid("active_space_id")
    .notNull()
    .references(() => spaces.id, { onDelete: "cascade" }),
  camera: jsonb("camera").$type<{ x: number; y: number; zoom: number }>().notNull(),
  pointer: jsonb("pointer").$type<{ x: number; y: number } | null>(),
  displayName: varchar("display_name", { length: 32 }),
  sigil: varchar("sigil", { length: 16 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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
  searchBlob: text("search_blob").notNull().default(""),
  contentJson: jsonb("content_json").$type<Record<string, unknown> | null>(),

  imageUrl: text("image_url"),
  imageMeta: jsonb("image_meta").$type<Record<string, unknown> | null>(),

  color: varchar("color", { length: 64 }),

  entityType: varchar("entity_type", { length: 64 }),
  entityMeta: jsonb("entity_meta").$type<Record<string, unknown> | null>(),

  stackId: uuid("stack_id"),
  stackOrder: integer("stack_order"),

  /** LLM-generated compact index for FTS + retrieval (refreshed on vault index). */
  loreSummary: text("lore_summary"),
  loreAliases: jsonb("lore_aliases").$type<string[] | null>(),
  loreIndexedAt: timestamp("lore_indexed_at", { withTimezone: true }),
  /** SHA-256 (hex) of title+content_text lore-meta prompt last sent to Anthropic; skips duplicate API calls. */
  loreMetaSourceHash: varchar("lore_meta_source_hash", { length: 64 }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/** Import / ingestion review queue (contradictions, future notifications). */
export const importReviewItems = pgTable("import_review_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  importBatchId: uuid("import_batch_id").notNull(),
  spaceId: uuid("space_id").references(() => spaces.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 32 }).notNull().default("pending"),
  kind: varchar("kind", { length: 64 }).notNull().default("contradiction"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/** Async smart-import plan generation (`after()` worker updates status + plan). */
export const loreImportJobs = pgTable("lore_import_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  spaceId: uuid("space_id")
    .notNull()
    .references(() => spaces.id, { onDelete: "cascade" }),
  importBatchId: uuid("import_batch_id").notNull(),
  status: varchar("status", { length: 32 }).notNull().default("queued"),
  sourceText: text("source_text").notNull(),
  fileName: varchar("file_name", { length: 512 }),
  userContext: jsonb("user_context").$type<Record<string, unknown> | null>(),
  plan: jsonb("plan").$type<Record<string, unknown> | null>(),
  error: text("error"),
  progressPhase: varchar("progress_phase", { length: 64 }),
  progressStep: integer("progress_step"),
  progressTotal: integer("progress_total"),
  progressMessage: text("progress_message"),
  progressMeta: jsonb("progress_meta").$type<Record<string, unknown> | null>(),
  progressEvents: jsonb("progress_events").$type<Record<string, unknown>[] | null>(),
  lastProgressAt: timestamp("last_progress_at", { withTimezone: true }),
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
  linkType: varchar("link_type", { length: 64 }).notNull().default("pin"),
    label: text("label"),
    sourcePin: varchar("source_pin", { length: 64 }),
    targetPin: varchar("target_pin", { length: 64 }),
    color: varchar("color", { length: 128 }),
    meta: jsonb("meta").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    unique("item_links_source_target_pin_uidx").on(
      t.sourceItemId,
      t.targetItemId,
      t.sourcePin,
      t.targetPin,
    ),
    // REVIEW_2026-04-25_1730 M5: revision query and target-side fetches
    // (`/api/items/[id]/links` reverse direction) filter on this column.
    index("item_links_target_item_id_idx").on(t.targetItemId),
  ],
);

export const entityMentions = pgTable(
  "entity_mentions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceItemId: uuid("source_item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    targetItemId: uuid("target_item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    matchedTerm: text("matched_term").notNull(),
    mentionCount: integer("mention_count").notNull().default(1),
    snippet: text("snippet"),
    headingPath: text("heading_path"),
    braneId: uuid("brane_id")
      .notNull()
      .references(() => branes.id, { onDelete: "cascade" }),
    sourceSpaceId: uuid("source_space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    sourceKind: varchar("source_kind", { length: 16 }).notNull().default("term"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    unique("entity_mentions_source_target_term_kind_uidx").on(
      t.sourceItemId,
      t.targetItemId,
      t.matchedTerm,
      t.sourceKind,
    ),
    // REVIEW_2026-04-25_1730 L4: Mirror migration 0017's CHECK constraint in
    // schema.ts so drizzle-kit diffs stay clean and an introspection-driven
    // migration cannot silently drop the database-level invariant that a
    // mention's source and target items must differ.
    check(
      "entity_mentions_source_not_target_chk",
      sql`${t.sourceItemId} <> ${t.targetItemId}`,
    ),
  ],
);

/** Chunk embeddings for semantic search; rebuilt by vault index pipeline. */
export const itemEmbeddings = pgTable("item_embeddings", {
  id: uuid("id").defaultRandom().primaryKey(),
  itemId: uuid("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  spaceId: uuid("space_id")
    .notNull()
    .references(() => spaces.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull().default(0),
  /** sha256 hex of chunk text at index time (debug / future skip). */
  contentHash: varchar("content_hash", { length: 64 }).notNull().default(""),
  sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }).notNull(),
  embedding: vector1536("embedding"),
  chunkText: text("chunk_text").notNull(),
  /** JSON-encoded heading breadcrumb path used for section-aware retrieval/citations. */
  headingPath: text("heading_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
