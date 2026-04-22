import { describe, expect, it } from "vitest";

import {
  AI_REVIEW_CLEARED,
  buildImportedEntityMeta,
  hasActionableAiReview,
  importedEntityMetaSchema,
  isAiReviewPending,
  parseImportedEntityMeta,
  readAiReviewState,
  withCrossFolderRef,
} from "@/src/lib/entity-meta-schema";

describe("entity-meta-schema", () => {
  it("parses a minimal importer meta", () => {
    const parsed = parseImportedEntityMeta({
      import: true,
      importBatchId: "11111111-1111-4111-8111-111111111111",
      canonicalEntityKind: "npc",
      aiReview: "pending",
    });
    expect(parsed).not.toBeNull();
    expect(parsed?.canonicalEntityKind).toBe("npc");
    expect(parsed?.aiReview).toBe("pending");
  });

  it("accepts cleared review state for runtime/editor writes", () => {
    const parsed = parseImportedEntityMeta({
      aiReview: AI_REVIEW_CLEARED,
    });
    expect(parsed?.aiReview).toBe(AI_REVIEW_CLEARED);
  });

  it("preserves unknown keys via passthrough", () => {
    const parsed = parseImportedEntityMeta({
      import: true,
      unknownExternalKey: "hello",
      nested: { foo: 1 },
    });
    expect(parsed).not.toBeNull();
    const record = parsed as unknown as Record<string, unknown>;
    expect(record.unknownExternalKey).toBe("hello");
    expect(record.nested).toEqual({ foo: 1 });
  });

  it("rejects malformed canonicalEntityKind", () => {
    const result = importedEntityMetaSchema.safeParse({
      canonicalEntityKind: "dragon",
    });
    expect(result.success).toBe(false);
  });

  it("buildImportedEntityMeta merges existing + base + explicit fields", () => {
    const meta = buildImportedEntityMeta({
      existing: { legacyKey: "keep", aiReview: "accepted" },
      base: { import: true, canonicalEntityKind: "npc" },
      importBatchId: "11111111-1111-4111-8111-111111111111",
      aiReview: "pending",
    });
    expect(meta.import).toBe(true);
    expect(meta.canonicalEntityKind).toBe("npc");
    expect(meta.importBatchId).toBe("11111111-1111-4111-8111-111111111111");
    expect(meta.aiReview).toBe("pending");
    const record = meta as unknown as Record<string, unknown>;
    expect(record.legacyKey).toBe("keep");
  });

  it("buildImportedEntityMeta throws on invalid input", () => {
    expect(() =>
      buildImportedEntityMeta({
        canonicalEntityKind: "dragon" as never,
      }),
    ).toThrow(/invalid entity_meta/);
  });

  it("withCrossFolderRef deduplicates by target title + id", () => {
    const base = buildImportedEntityMeta({ import: true });
    const once = withCrossFolderRef(base, {
      targetTitle: "Moonhold",
      linkType: "history",
    });
    const twice = withCrossFolderRef(once, {
      targetTitle: "Moonhold",
      linkType: "history",
    });
    expect(once.crossFolderRefs).toHaveLength(1);
    expect(twice.crossFolderRefs).toHaveLength(1);
  });

  it("parseImportedEntityMeta returns null for non-objects", () => {
    expect(parseImportedEntityMeta(null)).toBeNull();
    expect(parseImportedEntityMeta("hi")).toBeNull();
    expect(parseImportedEntityMeta(42)).toBeNull();
  });

  it("exposes helpers for actionable review checks", () => {
    expect(readAiReviewState({ aiReview: "pending" })).toBe("pending");
    expect(readAiReviewState({ aiReview: "unknown" })).toBeNull();
    expect(isAiReviewPending({ aiReview: "pending" })).toBe(true);
    expect(isAiReviewPending({ aiReview: "accepted" })).toBe(false);
    expect(hasActionableAiReview({ aiReview: "pending" }, false)).toBe(true);
    expect(hasActionableAiReview({ aiReview: "accepted" }, true)).toBe(true);
    expect(hasActionableAiReview({ aiReview: "accepted" }, false)).toBe(false);
  });
});
