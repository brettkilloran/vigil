/**
 * Discriminated, validated shape for `items.entity_meta` values written by the lore
 * import pipeline. Known keys are typed; unknown keys are preserved via `.passthrough()`
 * so existing reads keep working while every new write goes through `buildImportedEntityMeta`.
 *
 * @see docs/LORE_IMPORT_AUDIT_2026-04-21.md §4.8
 */
import { z } from "zod";

import { CANONICAL_ENTITY_KINDS } from "@/src/lib/lore-import-canonical-kinds";
import {
  ingestionSignalsSchema,
  loreImportLinkIntentSchema,
} from "@/src/lib/lore-import-plan-types";

export const canonicalEntityKindSchema = z.enum(
  CANONICAL_ENTITY_KINDS as unknown as [string, ...string[]]
);

export const importProvenanceSchema = z
  .object({
    chunkIds: z.array(z.string().uuid()).max(256),
    jobId: z.string().uuid().optional(),
  })
  .strict();

export const crossFolderRefSchema = z
  .object({
    targetItemId: z.string().uuid().optional(),
    targetTitle: z.string().min(1).max(255),
    linkType: z.string().min(1).max(64),
    linkIntent: loreImportLinkIntentSchema,
  })
  .strip();

export const AI_REVIEW_PENDING = "pending";
export const AI_REVIEW_ACCEPTED = "accepted";
export const AI_REVIEW_CLEARED = "cleared";
export const aiReviewStateSchema = z.enum([
  AI_REVIEW_PENDING,
  AI_REVIEW_ACCEPTED,
  AI_REVIEW_CLEARED,
]);

/**
 * Zod schema for the subset of `items.entity_meta` keys the importer knows about.
 * `.passthrough()` keeps legacy / external keys intact so we don't strip anything
 * on round-trip through `parseImportedEntityMeta`.
 */
export const importedEntityMetaSchema = z
  .object({
    schemaVersion: z.number().int().optional(),
    import: z.boolean().optional(),
    importBatchId: z.string().uuid().optional(),
    canonicalEntityKind: canonicalEntityKindSchema.optional(),
    ingestionSignals: ingestionSignalsSchema,
    campaignEpoch: z.number().int().optional(),
    loreHistorical: z.boolean().optional(),
    aiReview: aiReviewStateSchema.optional(),
    importProvenance: importProvenanceSchema.optional(),
    crossFolderRefs: z.array(crossFolderRefSchema).max(64).optional(),
  })
  .passthrough();

export type ImportedEntityMeta = z.infer<typeof importedEntityMetaSchema>;
export type CrossFolderRef = z.infer<typeof crossFolderRefSchema>;
export type ImportProvenance = z.infer<typeof importProvenanceSchema>;
export type AiReviewState = z.infer<typeof aiReviewStateSchema>;

export function readAiReviewState(
  entityMeta: Record<string, unknown> | null | undefined
): AiReviewState | null {
  const raw = entityMeta?.aiReview;
  if (
    raw === AI_REVIEW_PENDING ||
    raw === AI_REVIEW_ACCEPTED ||
    raw === AI_REVIEW_CLEARED
  ) {
    return raw;
  }
  return null;
}

export function isAiReviewPending(
  entityMeta: Record<string, unknown> | null | undefined
): boolean {
  return readAiReviewState(entityMeta) === AI_REVIEW_PENDING;
}

export function hasActionableAiReview(
  entityMeta: Record<string, unknown> | null | undefined,
  hasPendingBodyMarkup: boolean
): boolean {
  return hasPendingBodyMarkup || isAiReviewPending(entityMeta);
}

/**
 * Parse a raw `items.entity_meta` blob into the typed shape. Returns null when the
 * value is not a plain object; unknown keys are preserved. This is deliberately
 * forgiving because older rows may have `entity_meta` written before the schema existed.
 */
export function parseImportedEntityMeta(
  raw: unknown
): ImportedEntityMeta | null {
  if (raw == null || typeof raw !== "object") {
    return null;
  }
  const parsed = importedEntityMetaSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  return parsed.data;
}

export interface BuildImportedEntityMetaInput {
  aiReview?: AiReviewState;
  /** Merged-in base (e.g. `buildDefaultEntityMeta(note)`) that the importer owns. */
  base?: Record<string, unknown> | ImportedEntityMeta | null;
  canonicalEntityKind?: ImportedEntityMeta["canonicalEntityKind"];
  crossFolderRefs?: CrossFolderRef[];
  /** Additional unknown-key passthrough from existing row (merges into output). */
  existing?: Record<string, unknown> | ImportedEntityMeta | null;
  /** Explicit marker that this write originated in the import pipeline. */
  import?: boolean;
  importBatchId?: string;
  importProvenance?: ImportProvenance;
}

/**
 * Build a validated entity_meta object. Throws when the result fails schema validation so
 * the apply path catches drift at write time instead of months later during a search.
 *
 * Merge rules: `existing` keys come first (so unknown legacy keys round-trip), `base`
 * overlays on top, then explicit named fields win last.
 */
export function buildImportedEntityMeta(
  input: BuildImportedEntityMetaInput
): ImportedEntityMeta {
  const existing =
    input.existing && typeof input.existing === "object"
      ? (input.existing as Record<string, unknown>)
      : {};
  const base =
    input.base && typeof input.base === "object"
      ? (input.base as Record<string, unknown>)
      : {};

  const merged: Record<string, unknown> = { ...existing, ...base };

  if (input.importBatchId !== undefined) {
    merged.importBatchId = input.importBatchId;
  }
  if (input.canonicalEntityKind !== undefined) {
    merged.canonicalEntityKind = input.canonicalEntityKind;
  }
  if (input.aiReview !== undefined) {
    merged.aiReview = input.aiReview;
  }
  if (input.importProvenance !== undefined) {
    merged.importProvenance = input.importProvenance;
  }
  if (input.crossFolderRefs !== undefined) {
    merged.crossFolderRefs = input.crossFolderRefs;
  }
  if (input.import !== undefined) {
    merged.import = input.import;
  }

  const parsed = importedEntityMetaSchema.safeParse(merged);
  if (!parsed.success) {
    throw new Error(
      `buildImportedEntityMeta produced invalid entity_meta: ${parsed.error.message}`
    );
  }
  return parsed.data;
}

/**
 * Append a cross-folder mention reference to the given entity_meta object, deduplicated
 * by `targetItemId` + `targetTitle`. Used by the cross-folder mention injection path
 * (§5 of the plan). Returns a new object; the input is not mutated.
 */
export function withCrossFolderRef(
  entityMeta: Record<string, unknown> | ImportedEntityMeta | null | undefined,
  ref: CrossFolderRef
): ImportedEntityMeta {
  const base =
    entityMeta && typeof entityMeta === "object"
      ? (entityMeta as Record<string, unknown>)
      : {};
  const existingRefs = Array.isArray(base.crossFolderRefs)
    ? (base.crossFolderRefs as CrossFolderRef[])
    : [];
  const key = (r: CrossFolderRef) =>
    `${r.targetItemId ?? ""}|${r.targetTitle}`.toLowerCase();
  const seen = new Set(existingRefs.map(key));
  const nextRefs = seen.has(key(ref))
    ? existingRefs
    : [...existingRefs, ref].slice(0, 64);
  return buildImportedEntityMeta({
    existing: base,
    crossFolderRefs: nextRefs,
  });
}
