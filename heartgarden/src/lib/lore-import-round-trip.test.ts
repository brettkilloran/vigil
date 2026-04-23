import { describe, expect, it } from "vitest";

import {
  buildSourceCardDraftsFromPlan,
  SOURCE_SECTION_CARD_MAX_CHARS,
  splitIntoSourceParts,
} from "@/src/lib/lore-import-apply";
import { attachBodiesToOutline } from "@/src/lib/lore-import-plan-llm";

describe("lore import round-trip guards", () => {
  it("splits oversized source sections into ordered Part cards", () => {
    const huge = "A".repeat(SOURCE_SECTION_CARD_MAX_CHARS * 2 + 200);
    const drafts = buildSourceCardDraftsFromPlan(
      {
        importBatchId: "11111111-1111-4111-8111-111111111111",
        sourceCharCount: huge.length,
        folders: [],
        notes: [],
        links: [],
        mergeProposals: [],
        contradictions: [],
        clarifications: [],
        chunks: [
          {
            id: "22222222-2222-4222-8222-222222222222",
            heading: "Incident Report",
            charStart: 0,
            charEnd: huge.length,
            body: huge,
          },
        ],
      } as never,
      huge,
      "Import source",
    );
    expect(drafts.length).toBeGreaterThan(1);
    expect(drafts[0]?.title).toContain("Part 1");
    expect(drafts[1]?.title).toContain("Part 2");
    const combined = drafts.map((d) => d.text).join("");
    expect(combined.length).toBe(huge.length);
  });

  it("splitIntoSourceParts keeps complete coverage", () => {
    const text = "B".repeat(SOURCE_SECTION_CARD_MAX_CHARS + 321);
    const parts = splitIntoSourceParts(text);
    expect(parts.length).toBe(2);
    expect(parts.join("")).toBe(text);
  });

  it("tracks duplicate grounded passages across notes", () => {
    const chunks = [
      {
        id: "33333333-3333-4333-8333-333333333333",
        heading: "Document",
        body: "The Obsidian Shard emitted a pulse visible to all divers.",
        charStart: 0,
        charEnd: 64,
      },
    ];
    const outline = {
      folders: [],
      links: [],
      notes: [
        {
          clientId: "n1",
          title: "Shard",
          canonicalEntityKind: "item" as const,
          summary: "",
          folderClientId: null,
          sourceChunkIds: [chunks[0]!.id],
          sourcePassages: [{ chunkId: chunks[0]!.id, quote: "The Obsidian Shard emitted a pulse visible to all divers." }],
          body: {
            kind: "generic" as const,
            blocks: [{ kind: "paragraph", text: "The Obsidian Shard emitted a pulse visible to all divers." }],
          },
        },
        {
          clientId: "n2",
          title: "Divers",
          canonicalEntityKind: "other" as const,
          summary: "",
          folderClientId: null,
          sourceChunkIds: [chunks[0]!.id],
          sourcePassages: [{ chunkId: chunks[0]!.id, quote: "The Obsidian Shard emitted a pulse visible to all divers." }],
          body: {
            kind: "generic" as const,
            blocks: [{ kind: "paragraph", text: "Witnesses saw the same pulse event." }],
          },
        },
      ],
    };
    const diagnostics = attachBodiesToOutline(outline as never, chunks as never);
    expect(diagnostics.duplicateQuotePassages.length).toBeGreaterThan(0);
    expect(diagnostics.duplicateQuotePassages[0]?.noteClientIds).toEqual(["n1", "n2"]);
  });
});
