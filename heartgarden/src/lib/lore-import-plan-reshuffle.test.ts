import { describe, expect, it } from "vitest";

import {
  collapseToOneNote,
  filterAutoResolvedClarifications,
  flipOrgMode,
} from "@/src/lib/lore-import-plan-reshuffle";
import type { LoreImportPlan } from "@/src/lib/lore-import-plan-types";

const BASE_PLAN: LoreImportPlan = {
  clarifications: [
    {
      category: "structure",
      id: "44444444-4444-4444-8444-444444444444",
      options: [
        {
          id: "a",
          label: "Keep in Factions",
          planPatchHint: {
            folderClientId: "f1",
            noteClientId: "n1",
            op: "set_note_folder",
          },
          recommended: true,
        },
        {
          id: "b",
          label: "No folder",
          planPatchHint: {
            folderClientId: null,
            noteClientId: "n1",
            op: "set_note_folder",
          },
        },
      ],
      questionKind: "single_select",
      severity: "required",
      title: "Where should Ember Consortium live?",
    },
    {
      category: "conflict",
      id: "55555555-5555-4555-8555-555555555555",
      options: [
        {
          id: "a",
          label: "Discard",
          planPatchHint: {
            mergeProposalId: "22222222-2222-4222-8222-222222222222",
            op: "discard_merge_proposal",
          },
          recommended: true,
        },
        {
          id: "b",
          label: "Keep",
          planPatchHint: { op: "no_op" },
        },
      ],
      questionKind: "single_select",
      relatedMergeProposalId: "22222222-2222-4222-8222-222222222222",
      severity: "required",
      title: "Keep merge proposal?",
    },
  ],
  contradictions: [],
  folders: [{ clientId: "f1", parentClientId: null, title: "Factions" }],
  importBatchId: "11111111-1111-4111-8111-111111111111",
  links: [],
  mergeProposals: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      noteClientId: "n1",
      proposedText: "Update",
      strategy: "append_dated",
      targetItemId: "33333333-3333-4333-8333-333333333333",
      targetTitle: "Ember Consortium",
    },
  ],
  notes: [
    {
      bodyText: "Faction body",
      canonicalEntityKind: "faction",
      clientId: "n1",
      folderClientId: "f1",
      ingestionSignals: undefined,
      summary: "A faction",
      title: "Ember Consortium",
    },
  ],
  sourceCharCount: 1200,
};

describe("lore-import-plan-reshuffle", () => {
  it("drops structure clarifications in nearby mode", () => {
    const next = flipOrgMode(BASE_PLAN, "nearby");
    expect(next.userContext?.orgMode).toBe("nearby");
    expect(next.clarifications.map((c) => c.id)).toEqual([
      "55555555-5555-4555-8555-555555555555",
    ]);
  });

  it("collapses plan to one note and clears clarifications", () => {
    const next = collapseToOneNote(BASE_PLAN, {
      text: "All source text",
      title: "Session 12 import",
    });
    expect(next.userContext?.granularity).toBe("one_note");
    expect(next.userContext?.orgMode).toBe("nearby");
    expect(next.notes).toHaveLength(0);
    expect(next.folders).toHaveLength(0);
    expect(next.links).toHaveLength(0);
    expect(next.mergeProposals).toHaveLength(0);
    expect(next.clarifications).toHaveLength(0);
    expect(next.oneNoteSource?.text).toBe("All source text");
  });

  it("drops merge-related clarifications when proposal is gone", () => {
    const withoutMerge: LoreImportPlan = {
      ...BASE_PLAN,
      mergeProposals: [],
    };
    const next = filterAutoResolvedClarifications(withoutMerge);
    expect(next.clarifications.map((c) => c.id)).toEqual([
      "44444444-4444-4444-8444-444444444444",
    ]);
  });
});
