import { describe, expect, it } from "vitest";

import {
  collapseToOneNote,
  filterAutoResolvedClarifications,
  flipOrgMode,
} from "@/src/lib/lore-import-plan-reshuffle";
import type { LoreImportPlan } from "@/src/lib/lore-import-plan-types";

const BASE_PLAN: LoreImportPlan = {
  importBatchId: "11111111-1111-4111-8111-111111111111",
  sourceCharCount: 1200,
  folders: [{ clientId: "f1", title: "Factions", parentClientId: null }],
  notes: [
    {
      clientId: "n1",
      title: "Ember Consortium",
      canonicalEntityKind: "faction",
      summary: "A faction",
      bodyText: "Faction body",
      folderClientId: "f1",
      ingestionSignals: undefined,
    },
  ],
  links: [],
  mergeProposals: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      noteClientId: "n1",
      targetItemId: "33333333-3333-4333-8333-333333333333",
      targetTitle: "Ember Consortium",
      strategy: "append_dated",
      proposedText: "Update",
    },
  ],
  contradictions: [],
  clarifications: [
    {
      id: "44444444-4444-4444-8444-444444444444",
      category: "structure",
      severity: "required",
      title: "Where should Ember Consortium live?",
      questionKind: "single_select",
      options: [
        {
          id: "a",
          label: "Keep in Factions",
          recommended: true,
          planPatchHint: {
            op: "set_note_folder",
            noteClientId: "n1",
            folderClientId: "f1",
          },
        },
        {
          id: "b",
          label: "No folder",
          planPatchHint: {
            op: "set_note_folder",
            noteClientId: "n1",
            folderClientId: null,
          },
        },
      ],
    },
    {
      id: "55555555-5555-4555-8555-555555555555",
      category: "conflict",
      severity: "required",
      title: "Keep merge proposal?",
      questionKind: "single_select",
      relatedMergeProposalId: "22222222-2222-4222-8222-222222222222",
      options: [
        {
          id: "a",
          label: "Discard",
          recommended: true,
          planPatchHint: {
            op: "discard_merge_proposal",
            mergeProposalId: "22222222-2222-4222-8222-222222222222",
          },
        },
        {
          id: "b",
          label: "Keep",
          planPatchHint: { op: "no_op" },
        },
      ],
    },
  ],
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
      title: "Session 12 import",
      text: "All source text",
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
