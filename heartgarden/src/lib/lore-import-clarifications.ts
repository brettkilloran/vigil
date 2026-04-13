import { randomUUID } from "crypto";

import type {
  ClarificationAnswer,
  LoreImportClarificationItem,
  LoreImportPlan,
  MergeProposal,
  PlanPatchHint,
} from "@/src/lib/lore-import-plan-types";
import {
  loreImportClarificationItemSchema,
  planPatchHintSchema,
} from "@/src/lib/lore-import-plan-types";

function clonePlan(plan: LoreImportPlan): LoreImportPlan {
  return structuredClone(plan) as LoreImportPlan;
}

export function applyPlanPatchHint(plan: LoreImportPlan, hint: PlanPatchHint): void {
  switch (hint.op) {
    case "no_op":
      return;
    case "set_note_folder": {
      const note = plan.notes.find((n) => n.clientId === hint.noteClientId);
      if (!note) {
        throw new Error(`Clarification patch: unknown note "${hint.noteClientId}"`);
      }
      if (hint.folderClientId !== null) {
        const folder = plan.folders.find((f) => f.clientId === hint.folderClientId);
        if (!folder) {
          throw new Error(`Clarification patch: unknown folder "${hint.folderClientId}"`);
        }
      }
      note.folderClientId = hint.folderClientId;
      return;
    }
    case "set_link_type": {
      const link = plan.links.find(
        (l) =>
          l.fromClientId === hint.fromClientId && l.toClientId === hint.toClientId,
      );
      if (!link) {
        throw new Error(
          `Clarification patch: no link ${hint.fromClientId} → ${hint.toClientId}`,
        );
      }
      link.linkType = hint.linkType;
      return;
    }
    case "remove_link": {
      plan.links = plan.links.filter(
        (l) =>
          !(
            l.fromClientId === hint.fromClientId && l.toClientId === hint.toClientId
          ),
      );
      return;
    }
    case "set_ingestion_signals": {
      const note = plan.notes.find((n) => n.clientId === hint.noteClientId);
      if (!note) {
        throw new Error(`Clarification patch: unknown note "${hint.noteClientId}"`);
      }
      note.ingestionSignals = { ...note.ingestionSignals, ...hint.patch };
      return;
    }
    case "set_lore_historical": {
      const note = plan.notes.find((n) => n.clientId === hint.noteClientId);
      if (!note) {
        throw new Error(`Clarification patch: unknown note "${hint.noteClientId}"`);
      }
      note.loreHistorical = hint.loreHistorical;
      return;
    }
    case "discard_merge_proposal": {
      const before = plan.mergeProposals.length;
      plan.mergeProposals = plan.mergeProposals.filter(
        (m) => m.id !== hint.mergeProposalId,
      );
      if (plan.mergeProposals.length === before) {
        throw new Error(
          `Clarification patch: unknown merge proposal "${hint.mergeProposalId}"`,
        );
      }
      return;
    }
    default: {
      const _exhaustive: never = hint;
      return _exhaustive;
    }
  }
}

function validateSingleAnswer(
  c: LoreImportClarificationItem,
  a: ClarificationAnswer,
): string | null {
  const optionIds = new Set(c.options.map((o) => o.id));
  if (a.resolution === "skipped_default") {
    const id = a.skipDefaultOptionId;
    if (!id) return `Clarification "${c.title}": skipDefaultOptionId is required`;
    if (!optionIds.has(id)) return `Clarification "${c.title}": invalid skipDefaultOptionId`;
    if (a.selectedOptionIds?.length) {
      return `Clarification "${c.title}": cannot use selectedOptionIds with skipped_default`;
    }
    return null;
  }
  const sel = a.selectedOptionIds ?? [];
  if (sel.length === 0) {
    return `Clarification "${c.title}": selectedOptionIds is required when resolution is answered`;
  }
  for (const id of sel) {
    if (!optionIds.has(id)) {
      return `Clarification "${c.title}": invalid option id "${id}"`;
    }
  }
  if (c.questionKind === "single_select" || c.questionKind === "confirm_default") {
    if (sel.length !== 1) {
      return `Clarification "${c.title}": pick exactly one option`;
    }
  }
  return null;
}

/**
 * Ensures every required clarification has a valid answer entry and answers are well-formed.
 */
export function validateClarificationAnswersForApply(
  plan: LoreImportPlan,
  answers: ClarificationAnswer[],
): { ok: true } | { ok: false; error: string } {
  const byId = new Map(plan.clarifications.map((c) => [c.id, c]));
  const seenAnswer = new Set<string>();
  for (const a of answers) {
    if (seenAnswer.has(a.clarificationId)) {
      return {
        ok: false,
        error: `Duplicate answer for clarification ${a.clarificationId}`,
      };
    }
    seenAnswer.add(a.clarificationId);
    const c = byId.get(a.clarificationId);
    if (!c) {
      return { ok: false, error: `Unknown clarification id ${a.clarificationId}` };
    }
    const err = validateSingleAnswer(c, a);
    if (err) return { ok: false, error: err };
  }
  for (const c of plan.clarifications) {
    if (c.severity !== "required") continue;
    if (!seenAnswer.has(c.id)) {
      return {
        ok: false,
        error: `Missing answer for required clarification: ${c.title}`,
      };
    }
  }
  return { ok: true };
}

/**
 * Applies user answers in **plan clarification order** so patches compose predictably.
 */
export function applyClarificationPatches(
  plan: LoreImportPlan,
  answers: ClarificationAnswer[],
): LoreImportPlan {
  const working = clonePlan(plan);
  const answerMap = new Map(answers.map((a) => [a.clarificationId, a]));
  for (const c of plan.clarifications) {
    const a = answerMap.get(c.id);
    if (!a) continue;
    const optIds =
      a.resolution === "skipped_default"
        ? [a.skipDefaultOptionId!]
        : (a.selectedOptionIds ?? []);
    for (const oid of optIds) {
      const opt = c.options.find((o) => o.id === oid);
      if (!opt) {
        throw new Error(`Clarification ${c.id}: missing option "${oid}"`);
      }
      applyPlanPatchHint(working, opt.planPatchHint);
    }
  }
  return working;
}

export function countRequiredClarificationsUnresolved(plan: LoreImportPlan): number {
  return plan.clarifications.filter((c) => c.severity === "required").length;
}

const MAX_CLARIFICATION_ITEMS = 40;

/**
 * Avoid huge LLM outputs: keep all required, add optional only while under the cap (optional trimmed first).
 */
export function capClarificationList(
  list: LoreImportClarificationItem[],
): LoreImportClarificationItem[] {
  if (list.length <= MAX_CLARIFICATION_ITEMS) return list;
  const required = list.filter((c) => c.severity === "required");
  const optional = list.filter((c) => c.severity === "optional");
  const room = Math.max(0, MAX_CLARIFICATION_ITEMS - required.length);
  if (room === 0) {
    return required.slice(0, MAX_CLARIFICATION_ITEMS);
  }
  return [...required, ...optional.slice(0, room)];
}

function parseHintLoose(o: unknown): PlanPatchHint | null {
  if (!o || typeof o !== "object") return null;
  const p = planPatchHintSchema.safeParse(o);
  return p.success ? p.data : null;
}

/**
 * Turn LLM clarification objects into validated items (assigns fresh ids).
 */
export function normalizeClarificationsFromLlm(raw: unknown): LoreImportClarificationItem[] {
  if (!Array.isArray(raw)) return [];
  const out: LoreImportClarificationItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const optionsIn = o.options;
    if (!Array.isArray(optionsIn)) continue;
    const options: {
      id: string;
      label: string;
      recommended?: boolean;
      planPatchHint: PlanPatchHint;
    }[] = [];
    for (const opt of optionsIn) {
      if (!opt || typeof opt !== "object") continue;
      const op = opt as Record<string, unknown>;
      const id = String(op.id ?? "").trim().slice(0, 64);
      const label = String(op.label ?? "").trim().slice(0, 500);
      const hint = parseHintLoose(op.planPatchHint);
      if (!id || !label || !hint) continue;
      options.push({
        id,
        label,
        recommended: op.recommended === true ? true : undefined,
        planPatchHint: hint,
      });
    }
    if (options.length < 2) continue;

    const category = o.category;
    const severity = o.severity;
    const questionKind = o.questionKind;
    if (
      category !== "structure" &&
      category !== "link_semantics" &&
      category !== "canon_weight" &&
      category !== "conflict"
    ) {
      continue;
    }
    if (severity !== "required" && severity !== "optional") continue;
    if (
      questionKind !== "single_select" &&
      questionKind !== "multi_select" &&
      questionKind !== "confirm_default"
    ) {
      continue;
    }

    const title = String(o.title ?? "").trim().slice(0, 300);
    if (!title) continue;

    const built = {
      id: randomUUID(),
      category,
      severity,
      title,
      context:
        o.context != null ? String(o.context).trim().slice(0, 4000) : undefined,
      questionKind,
      options,
      relatedNoteClientIds: Array.isArray(o.relatedNoteClientIds)
        ? o.relatedNoteClientIds
            .map((x) => String(x ?? "").trim().slice(0, 64))
            .filter(Boolean)
            .slice(0, 20)
        : undefined,
      relatedMergeProposalId:
        typeof o.relatedMergeProposalId === "string" &&
        /^[0-9a-f-]{36}$/i.test(o.relatedMergeProposalId)
          ? o.relatedMergeProposalId
          : undefined,
      relatedLink:
        o.relatedLink &&
        typeof o.relatedLink === "object" &&
        typeof (o.relatedLink as Record<string, unknown>).fromClientId === "string" &&
        typeof (o.relatedLink as Record<string, unknown>).toClientId === "string"
          ? {
              fromClientId: String(
                (o.relatedLink as Record<string, unknown>).fromClientId,
              ).slice(0, 64),
              toClientId: String(
                (o.relatedLink as Record<string, unknown>).toClientId,
              ).slice(0, 64),
            }
          : undefined,
    };

    const parsed = loreImportClarificationItemSchema.safeParse(built);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

/**
 * If the model returns no required "conflict" items but contradictions exist, add
 * deterministic questions so apply never blocks on an empty clarification set.
 */
export function ensureClarificationsForContradictions(
  contradictions: LoreImportPlan["contradictions"],
  mergeProposals: MergeProposal[],
  existing: LoreImportClarificationItem[],
): LoreImportClarificationItem[] {
  if (contradictions.length === 0) return existing;
  const hasRequiredConflict = existing.some(
    (c) => c.category === "conflict" && c.severity === "required",
  );
  if (hasRequiredConflict) return existing;

  const next = [...existing];
  for (const contra of contradictions) {
    const merge = contra.noteClientId
      ? mergeProposals.find((m) => m.noteClientId === contra.noteClientId)
      : undefined;
    const ctx = [contra.summary, contra.details].filter(Boolean).join("\n\n").slice(0, 4000);

    if (merge) {
      const built = {
        id: randomUUID(),
        category: "conflict" as const,
        severity: "required" as const,
        title: "Contradiction with an existing card — merge or split?",
        context: ctx || contra.summary,
        questionKind: "single_select" as const,
        options: [
          {
            id: "keep_merge",
            label: "Apply the merge into the existing card anyway",
            planPatchHint: { op: "no_op" as const },
          },
          {
            id: "skip_merge",
            label: "Skip this merge; create a separate new note",
            recommended: true as const,
            planPatchHint: {
              op: "discard_merge_proposal" as const,
              mergeProposalId: merge.id,
            },
          },
        ],
        relatedNoteClientIds: contra.noteClientId ? [contra.noteClientId] : undefined,
      };
      const parsed = loreImportClarificationItemSchema.safeParse(built);
      if (parsed.success) next.push(parsed.data);
    } else {
      const built = {
        id: randomUUID(),
        category: "conflict" as const,
        severity: "required" as const,
        title: "Flagged contradiction — confirm import",
        context: ctx || contra.summary,
        questionKind: "single_select" as const,
        options: contra.noteClientId
          ? [
              {
                id: "as_current",
                label: "Treat this note as current lore",
                recommended: true as const,
                planPatchHint: { op: "no_op" as const },
              },
              {
                id: "as_historical",
                label: "Mark this note as historical / past-tense in setting",
                planPatchHint: {
                  op: "set_lore_historical" as const,
                  noteClientId: contra.noteClientId,
                  loreHistorical: true,
                },
              },
            ]
          : [
              {
                id: "proceed",
                label: "Proceed with import",
                recommended: true as const,
                planPatchHint: { op: "no_op" as const },
              },
              {
                id: "proceed_ack",
                label: "Acknowledge and continue",
                planPatchHint: { op: "no_op" as const },
              },
            ],
        relatedNoteClientIds: contra.noteClientId ? [contra.noteClientId] : undefined,
      };
      const parsed = loreImportClarificationItemSchema.safeParse(built);
      if (parsed.success) next.push(parsed.data);
    }
  }
  return next;
}
