import { describe, expect, it } from "vitest";

import { buildLoreNoteContentJson } from "@/src/lib/lore-import-commit";
import {
  ALL_CANONICAL_KINDS,
  PERSISTED_ENTITY_TYPES,
  isPersistedEntityType,
  persistedEntityTypeForLoreSource,
  persistedEntityTypeFromCanonical,
} from "@/src/lib/lore-object-registry";
import { buildSearchBlob } from "@/src/lib/search-blob";

/**
 * Fails when a new canonical kind is added without wiring through search blob construction
 * (import apply path uses buildSearchBlob + persistedEntityTypeFromCanonical).
 */
describe("lore-import registry wiring", () => {
  it("buildSearchBlob accepts persisted entity type for every canonical kind", () => {
    for (const kind of ALL_CANONICAL_KINDS) {
      const persisted = persistedEntityTypeFromCanonical(kind);
      const contentJson = buildLoreNoteContentJson("hello", { aiPending: true });
      const blob = buildSearchBlob({
        title: "T",
        contentText: "hello",
        contentJson,
        entityType: persisted,
        entityMeta: { import: true, canonicalEntityKind: kind, aiReview: "pending" },
        imageUrl: null,
        imageMeta: null,
        loreSummary: null,
        loreAliases: null,
      });
      expect(blob.length).toBeGreaterThan(0);
      expect(blob).toContain("hello");
    }
  });

  it("persistedEntityTypeFromCanonical always returns a registered type", () => {
    for (const kind of ALL_CANONICAL_KINDS) {
      const persisted = persistedEntityTypeFromCanonical(kind);
      expect(isPersistedEntityType(persisted)).toBe(true);
    }
  });

  it("registers lore_source as the imported-source entity type", () => {
    expect(persistedEntityTypeForLoreSource()).toBe("lore_source");
    expect(isPersistedEntityType("lore_source")).toBe(true);
    expect(PERSISTED_ENTITY_TYPES).toContain("lore_source");
  });

  it("guards reject unregistered entity_type values", () => {
    expect(isPersistedEntityType("npc")).toBe(false); // npc maps to character before persisting
    expect(isPersistedEntityType("random")).toBe(false);
    expect(isPersistedEntityType(null)).toBe(false);
    expect(isPersistedEntityType(undefined)).toBe(false);
  });

  it("PERSISTED_ENTITY_TYPES covers every shell + canonical kind (minus npc alias)", () => {
    // npc collapses to character on persist, so the closed set is ALL_CANONICAL_KINDS
    // minus "npc" plus the dedicated shell name "character" plus "lore_source".
    const expected = new Set<string>([
      ...ALL_CANONICAL_KINDS.filter((k) => k !== "npc"),
      "character",
      "lore_source",
    ]);
    expect(new Set(PERSISTED_ENTITY_TYPES)).toEqual(expected);
  });
});
