import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";

import {
  applyClarificationPatches,
  validateClarificationAnswersForApply,
} from "@/src/lib/lore-import-clarifications";
import type { ClarificationAnswer, LoreImportPlan } from "@/src/lib/lore-import-plan-types";

function minimalPlan(
  overrides: Partial<LoreImportPlan> & Pick<LoreImportPlan, "clarifications">,
): LoreImportPlan {
  const importBatchId = randomUUID();
  return {
    importBatchId,
    sourceCharCount: 0,
    folders: [],
    notes: [
      {
        clientId: "n1",
        title: "Note one",
        canonicalEntityKind: "lore",
        summary: "S",
        bodyText: "Body",
        folderClientId: null,
        targetItemType: null,
      },
    ],
    links: [],
    mergeProposals: [],
    contradictions: [],
    clarifications: [],
    ...overrides,
  };
}

describe("validateClarificationAnswersForApply", () => {
  it("fails when a required clarification has no answer", () => {
    const cid = randomUUID();
    const plan = minimalPlan({
      clarifications: [
        {
          id: cid,
          category: "structure",
          severity: "required",
          title: "Pick folder",
          questionKind: "single_select",
          options: [
            { id: "a", label: "Root", planPatchHint: { op: "no_op" } },
            { id: "b", label: "Other", planPatchHint: { op: "no_op" } },
          ],
        },
      ],
    });
    const r = validateClarificationAnswersForApply(plan, []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Missing answer");
  });

  it("accepts answered single_select with one option id", () => {
    const cid = randomUUID();
    const plan = minimalPlan({
      clarifications: [
        {
          id: cid,
          category: "structure",
          severity: "required",
          title: "Pick",
          questionKind: "single_select",
          options: [
            { id: "a", label: "A", planPatchHint: { op: "no_op" } },
            { id: "b", label: "B", planPatchHint: { op: "no_op" } },
          ],
        },
      ],
    });
    const answers: ClarificationAnswer[] = [
      {
        clarificationId: cid,
        resolution: "answered",
        selectedOptionIds: ["a"],
      },
    ];
    expect(validateClarificationAnswersForApply(plan, answers)).toEqual({ ok: true });
  });

  it("accepts skipped_default with valid skipDefaultOptionId", () => {
    const cid = randomUUID();
    const plan = minimalPlan({
      clarifications: [
        {
          id: cid,
          category: "canon_weight",
          severity: "required",
          title: "Canon",
          questionKind: "confirm_default",
          options: [
            {
              id: "def",
              label: "Default",
              recommended: true,
              planPatchHint: { op: "no_op" },
            },
            { id: "alt", label: "Alt", planPatchHint: { op: "no_op" } },
          ],
        },
      ],
    });
    const answers: ClarificationAnswer[] = [
      {
        clarificationId: cid,
        resolution: "skipped_default",
        skipDefaultOptionId: "def",
      },
    ];
    expect(validateClarificationAnswersForApply(plan, answers)).toEqual({ ok: true });
  });

  it("rejects duplicate clarification answers", () => {
    const cid = randomUUID();
    const plan = minimalPlan({
      clarifications: [
        {
          id: cid,
          category: "structure",
          severity: "required",
          title: "Pick",
          questionKind: "single_select",
          options: [
            { id: "a", label: "A", planPatchHint: { op: "no_op" } },
            { id: "b", label: "B", planPatchHint: { op: "no_op" } },
          ],
        },
      ],
    });
    const answers: ClarificationAnswer[] = [
      {
        clarificationId: cid,
        resolution: "answered",
        selectedOptionIds: ["a"],
      },
      {
        clarificationId: cid,
        resolution: "answered",
        selectedOptionIds: ["b"],
      },
    ];
    const r = validateClarificationAnswersForApply(plan, answers);
    expect(r.ok).toBe(false);
  });
});

describe("applyClarificationPatches", () => {
  it("applies set_note_folder", () => {
    const qid = randomUUID();
    const plan = minimalPlan({
      folders: [
        { clientId: "f1", title: "F1" },
        { clientId: "f2", title: "F2" },
      ],
      notes: [
        {
          clientId: "n1",
          title: "N",
          canonicalEntityKind: "lore",
          summary: "S",
          bodyText: "B",
          folderClientId: "f1",
          targetItemType: null,
        },
      ],
      clarifications: [
        {
          id: qid,
          category: "structure",
          severity: "required",
          title: "Folder",
          questionKind: "single_select",
          options: [
            {
              id: "to_f2",
              label: "F2",
              planPatchHint: {
                op: "set_note_folder",
                noteClientId: "n1",
                folderClientId: "f2",
              },
            },
            {
              id: "stay",
              label: "Stay",
              planPatchHint: { op: "no_op" },
            },
          ],
        },
      ],
    });
    const next = applyClarificationPatches(plan, [
      {
        clarificationId: qid,
        resolution: "answered",
        selectedOptionIds: ["to_f2"],
      },
    ]);
    expect(next.notes[0]!.folderClientId).toBe("f2");
  });

  it("discards merge proposal", () => {
    const mid = randomUUID();
    const qid = randomUUID();
    const plan = minimalPlan({
      mergeProposals: [
        {
          id: mid,
          noteClientId: "n1",
          targetItemId: randomUUID(),
          targetTitle: "T",
          strategy: "append_dated",
          proposedText: "x",
        },
      ],
      clarifications: [
        {
          id: qid,
          category: "conflict",
          severity: "required",
          title: "Merge?",
          questionKind: "single_select",
          options: [
            {
              id: "drop",
              label: "Drop",
              planPatchHint: { op: "discard_merge_proposal", mergeProposalId: mid },
            },
            { id: "keep", label: "Keep", planPatchHint: { op: "no_op" } },
          ],
        },
      ],
    });
    const next = applyClarificationPatches(plan, [
      {
        clarificationId: qid,
        resolution: "answered",
        selectedOptionIds: ["drop"],
      },
    ]);
    expect(next.mergeProposals).toHaveLength(0);
  });
});
