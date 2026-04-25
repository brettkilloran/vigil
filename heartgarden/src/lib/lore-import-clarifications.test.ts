import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  applyClarificationPatches,
  capClarificationList,
  resolveOtherClarificationAnswers,
  validateClarificationAnswersForApply,
} from "@/src/lib/lore-import-clarifications";
import type {
  ClarificationAnswer,
  LoreImportPlan,
} from "@/src/lib/lore-import-plan-types";

function minimalPlan(
  overrides: Partial<LoreImportPlan> & Pick<LoreImportPlan, "clarifications">
): LoreImportPlan {
  const importBatchId = randomUUID();
  return {
    contradictions: [],
    folders: [],
    importBatchId,
    links: [],
    mergeProposals: [],
    notes: [
      {
        bodyText: "Body",
        canonicalEntityKind: "lore",
        clientId: "n1",
        folderClientId: null,
        summary: "S",
        targetItemType: null,
        title: "Note one",
      },
    ],
    sourceCharCount: 0,
    ...overrides,
  };
}

describe("validateClarificationAnswersForApply", () => {
  it("fails when a required clarification has no answer", () => {
    const cid = randomUUID();
    const plan = minimalPlan({
      clarifications: [
        {
          category: "structure",
          id: cid,
          options: [
            { id: "a", label: "Root", planPatchHint: { op: "no_op" } },
            { id: "b", label: "Other", planPatchHint: { op: "no_op" } },
          ],
          questionKind: "single_select",
          severity: "required",
          title: "Pick folder",
        },
      ],
    });
    const r = validateClarificationAnswersForApply(plan, []);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("Missing answer");
    }
  });

  it("accepts answered single_select with one option id", () => {
    const cid = randomUUID();
    const plan = minimalPlan({
      clarifications: [
        {
          category: "structure",
          id: cid,
          options: [
            { id: "a", label: "A", planPatchHint: { op: "no_op" } },
            { id: "b", label: "B", planPatchHint: { op: "no_op" } },
          ],
          questionKind: "single_select",
          severity: "required",
          title: "Pick",
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
    expect(validateClarificationAnswersForApply(plan, answers)).toEqual({
      ok: true,
    });
  });

  it("accepts skipped_default with valid skipDefaultOptionId", () => {
    const cid = randomUUID();
    const plan = minimalPlan({
      clarifications: [
        {
          category: "canon_weight",
          id: cid,
          options: [
            {
              id: "def",
              label: "Default",
              planPatchHint: { op: "no_op" },
              recommended: true,
            },
            { id: "alt", label: "Alt", planPatchHint: { op: "no_op" } },
          ],
          questionKind: "confirm_default",
          severity: "required",
          title: "Canon",
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
    expect(validateClarificationAnswersForApply(plan, answers)).toEqual({
      ok: true,
    });
  });

  it("rejects duplicate clarification answers", () => {
    const cid = randomUUID();
    const plan = minimalPlan({
      clarifications: [
        {
          category: "structure",
          id: cid,
          options: [
            { id: "a", label: "A", planPatchHint: { op: "no_op" } },
            { id: "b", label: "B", planPatchHint: { op: "no_op" } },
          ],
          questionKind: "single_select",
          severity: "required",
          title: "Pick",
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

  it("accepts other_text answer when text is present", () => {
    const cid = randomUUID();
    const plan = minimalPlan({
      clarifications: [
        {
          category: "conflict",
          id: cid,
          options: [
            { id: "a", label: "A", planPatchHint: { op: "no_op" } },
            { id: "b", label: "B", planPatchHint: { op: "no_op" } },
          ],
          questionKind: "single_select",
          severity: "required",
          title: "Clarify",
        },
      ],
    });
    const answers: ClarificationAnswer[] = [
      {
        clarificationId: cid,
        otherText: "This assumption is wrong, use a separate NPC.",
        resolution: "other_text",
      },
    ];
    expect(validateClarificationAnswersForApply(plan, answers)).toEqual({
      ok: true,
    });
  });
});

describe("capClarificationList", () => {
  it("drops optional items first when over cap", () => {
    const twoOpt = {
      category: "structure" as const,
      id: randomUUID(),
      options: [
        { id: "a", label: "A", planPatchHint: { op: "no_op" as const } },
        { id: "b", label: "B", planPatchHint: { op: "no_op" as const } },
      ],
      questionKind: "single_select" as const,
      severity: "optional" as const,
      title: "O",
    };
    const req = {
      category: "structure" as const,
      id: randomUUID(),
      options: [
        { id: "a", label: "A", planPatchHint: { op: "no_op" as const } },
        { id: "b", label: "B", planPatchHint: { op: "no_op" as const } },
      ],
      questionKind: "single_select" as const,
      severity: "required" as const,
      title: "R",
    };
    const list = Array.from({ length: 50 }, (_, i) =>
      i === 0 ? req : { ...twoOpt, id: randomUUID() }
    );
    const capped = capClarificationList(list);
    expect(capped.length).toBe(40);
    expect(capped.some((c) => c.id === req.id)).toBe(true);
  });
});

describe("applyClarificationPatches", () => {
  it("applies set_note_folder", () => {
    const qid = randomUUID();
    const plan = minimalPlan({
      clarifications: [
        {
          category: "structure",
          id: qid,
          options: [
            {
              id: "to_f2",
              label: "F2",
              planPatchHint: {
                folderClientId: "f2",
                noteClientId: "n1",
                op: "set_note_folder",
              },
            },
            {
              id: "stay",
              label: "Stay",
              planPatchHint: { op: "no_op" },
            },
          ],
          questionKind: "single_select",
          severity: "required",
          title: "Folder",
        },
      ],
      folders: [
        { clientId: "f1", title: "F1" },
        { clientId: "f2", title: "F2" },
      ],
      notes: [
        {
          bodyText: "B",
          canonicalEntityKind: "lore",
          clientId: "n1",
          folderClientId: "f1",
          summary: "S",
          targetItemType: null,
          title: "N",
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
    expect(next.notes[0]?.folderClientId).toBe("f2");
  });

  it("discards merge proposal", () => {
    const mid = randomUUID();
    const qid = randomUUID();
    const plan = minimalPlan({
      clarifications: [
        {
          category: "conflict",
          id: qid,
          options: [
            {
              id: "drop",
              label: "Drop",
              planPatchHint: {
                mergeProposalId: mid,
                op: "discard_merge_proposal",
              },
            },
            { id: "keep", label: "Keep", planPatchHint: { op: "no_op" } },
          ],
          questionKind: "single_select",
          severity: "required",
          title: "Merge?",
        },
      ],
      mergeProposals: [
        {
          id: mid,
          noteClientId: "n1",
          proposedText: "x",
          strategy: "append_dated",
          targetItemId: randomUUID(),
          targetTitle: "T",
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

  it("uses recommended option for skipped_best_judgement", () => {
    const qid = randomUUID();
    const plan = minimalPlan({
      clarifications: [
        {
          category: "canon_weight",
          id: qid,
          options: [
            {
              id: "recommended",
              label: "Recommended",
              planPatchHint: { op: "no_op" },
              recommended: true,
            },
            { id: "other", label: "Other", planPatchHint: { op: "no_op" } },
          ],
          questionKind: "single_select",
          severity: "required",
          title: "Canon",
        },
      ],
    });
    const next = applyClarificationPatches(plan, [
      {
        clarificationId: qid,
        resolution: "skipped_best_judgement",
      },
    ]);
    expect(next.clarifications).toHaveLength(1);
  });
});

describe("resolveOtherClarificationAnswers", () => {
  it("resolves clear Other text into a concrete option", () => {
    const qid = randomUUID();
    const plan = minimalPlan({
      clarifications: [
        {
          category: "structure",
          id: qid,
          options: [
            {
              id: "conflict",
              label: "Keep conflict",
              planPatchHint: { op: "no_op" },
            },
            {
              id: "history",
              label: "Downgrade to history",
              planPatchHint: { op: "no_op" },
            },
          ],
          questionKind: "single_select",
          severity: "required",
          title: "Pick link",
        },
      ],
    });
    const result = resolveOtherClarificationAnswers(plan, [
      {
        clarificationId: qid,
        otherText: "Please downgrade to history; they only crossed paths.",
        resolution: "other_text",
      },
    ]);
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.answers[0]?.resolution).toBe("answered");
      expect(result.answers[0]?.selectedOptionIds).toEqual(["history"]);
    }
  });

  it("returns follow-up for ambiguous Other text", () => {
    const qid = randomUUID();
    const plan = minimalPlan({
      clarifications: [
        {
          category: "structure",
          id: qid,
          options: [
            {
              id: "maya",
              label: "Maya is target",
              planPatchHint: { op: "no_op" },
            },
            {
              id: "lucia",
              label: "Lucia is target",
              planPatchHint: { op: "no_op" },
            },
          ],
          questionKind: "single_select",
          severity: "required",
          title: "Clarify target",
        },
      ],
    });
    const result = resolveOtherClarificationAnswers(plan, [
      {
        clarificationId: qid,
        otherText: "This is unclear and not enough context.",
        resolution: "other_text",
      },
    ]);
    expect(result.status).toBe("needs_follow_up");
    if (result.status === "needs_follow_up") {
      expect(result.followUp.clarificationId).toBe(qid);
      expect(result.followUp.options.length).toBeGreaterThan(0);
    }
  });
});
