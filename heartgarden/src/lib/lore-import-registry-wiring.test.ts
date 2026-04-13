import { describe, expect, it } from "vitest";

import { buildLoreNoteContentJson } from "@/src/lib/lore-import-commit";
import { ALL_CANONICAL_KINDS, persistedEntityTypeFromCanonical } from "@/src/lib/lore-object-registry";
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
});
