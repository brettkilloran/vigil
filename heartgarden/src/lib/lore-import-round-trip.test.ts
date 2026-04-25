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
        chunks: [
          {
            body: huge,
            charEnd: huge.length,
            charStart: 0,
            heading: "Incident Report",
            id: "22222222-2222-4222-8222-222222222222",
          },
        ],
        clarifications: [],
        contradictions: [],
        folders: [],
        importBatchId: "11111111-1111-4111-8111-111111111111",
        links: [],
        mergeProposals: [],
        notes: [],
        sourceCharCount: huge.length,
      } as never,
      huge,
      "Import source"
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
        body: "The Obsidian Shard emitted a pulse visible to all divers.",
        charEnd: 64,
        charStart: 0,
        heading: "Document",
        id: "33333333-3333-4333-8333-333333333333",
      },
    ];
    const outline = {
      folders: [],
      links: [],
      notes: [
        {
          body: {
            blocks: [
              {
                kind: "paragraph",
                text: "The Obsidian Shard emitted a pulse visible to all divers.",
              },
            ],
            kind: "generic" as const,
          },
          canonicalEntityKind: "item" as const,
          clientId: "n1",
          folderClientId: null,
          sourceChunkIds: [chunks[0]?.id],
          sourcePassages: [
            {
              chunkId: chunks[0]?.id,
              quote:
                "The Obsidian Shard emitted a pulse visible to all divers.",
            },
          ],
          summary: "",
          title: "Shard",
        },
        {
          body: {
            blocks: [
              {
                kind: "paragraph",
                text: "Witnesses saw the same pulse event.",
              },
            ],
            kind: "generic" as const,
          },
          canonicalEntityKind: "other" as const,
          clientId: "n2",
          folderClientId: null,
          sourceChunkIds: [chunks[0]?.id],
          sourcePassages: [
            {
              chunkId: chunks[0]?.id,
              quote:
                "The Obsidian Shard emitted a pulse visible to all divers.",
            },
          ],
          summary: "",
          title: "Divers",
        },
      ],
    };
    const diagnostics = attachBodiesToOutline(
      outline as never,
      chunks as never
    );
    expect(diagnostics.duplicateQuotePassages.length).toBeGreaterThan(0);
    expect(diagnostics.duplicateQuotePassages[0]?.noteClientIds).toEqual([
      "n1",
      "n2",
    ]);
  });
});
