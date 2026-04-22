import { randomUUID } from "crypto";

import type {
  ClarificationAnswer,
  LoreImportClarificationItem,
  LoreImportPlan,
  LoreImportPlanNote,
  MergeProposal,
  PlanPatchHint,
} from "@/src/lib/lore-import-plan-types";
import {
  loreImportClarificationItemSchema,
  planPatchHintSchema,
} from "@/src/lib/lore-import-plan-types";

const OTHER_TEXT_MIN_LENGTH = 4;
const OTHER_RESOLVE_CLEAR_SCORE = 0.58;
const OTHER_RESOLVE_CLEAR_GAP = 0.12;

/** Link-type quizzes are low value during import; defaults + canvas editing suffice. */
export function withoutLinkSemanticsClarifications(
  items: LoreImportClarificationItem[],
): LoreImportClarificationItem[] {
  return items.filter((c) => c.category !== "link_semantics");
}

export type ClarificationFollowUpPrompt = {
  clarificationId: string;
  title: string;
  question: string;
  options: { id: string; label: string; recommended?: boolean }[];
  confidence: number;
  otherText: string;
};

function tokenizeLoose(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3);
}

function scoreOptionForOtherText(label: string, otherText: string): number {
  const labelTokens = tokenizeLoose(label);
  if (labelTokens.length === 0) return 0;
  const text = otherText.toLowerCase();
  const textTokens = new Set(tokenizeLoose(otherText));
  let overlap = 0;
  for (const token of labelTokens) {
    if (textTokens.has(token)) overlap += 1;
  }
  const overlapRatio = overlap / labelTokens.length;
  const phraseBoost = text.includes(label.toLowerCase()) ? 0.34 : 0;
  return Math.max(0, Math.min(1, overlapRatio + phraseBoost));
}

function bestJudgementOptionIds(c: LoreImportClarificationItem): string[] {
  if (c.questionKind === "multi_select") {
    const recommended = c.options.filter((o) => o.recommended).map((o) => o.id);
    return recommended.length > 0 ? recommended : [c.options[0]!.id];
  }
  const recommended = c.options.find((o) => o.recommended);
  return [recommended?.id ?? c.options[0]!.id];
}

function clonePlan(plan: LoreImportPlan): LoreImportPlan {
  return structuredClone(plan) as LoreImportPlan;
}

/**
 * Rebuild a note's `bodyText` from the plan's chunk bodies using the note's current
 * `sourceChunkIds`. Used by chunk-assignment patch ops so that re-assigning a chunk
 * at apply time actually updates what gets written to the card body.
 */
function rebuildNoteBodyText(plan: LoreImportPlan, note: LoreImportPlanNote): void {
  const byId = new Map((plan.chunks ?? []).map((c) => [c.id, c]));
  const ids = note.sourceChunkIds ?? [];
  const bodies: string[] = [];
  for (const cid of ids) {
    const ch = byId.get(cid);
    if (!ch || !ch.body) continue;
    bodies.push(`## ${ch.heading}\n\n${ch.body}`);
  }
  note.bodyText =
    bodies.length > 0
      ? bodies.join("\n\n---\n\n").slice(0, 120_000)
      : "";
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
    case "assign_chunk_to_note": {
      const note = plan.notes.find((n) => n.clientId === hint.noteClientId);
      if (!note) {
        throw new Error(`Clarification patch: unknown note "${hint.noteClientId}"`);
      }
      const chunk = (plan.chunks ?? []).find((c) => c.id === hint.chunkId);
      if (!chunk) {
        throw new Error(`Clarification patch: unknown chunk "${hint.chunkId}"`);
      }
      const ids = new Set(note.sourceChunkIds ?? []);
      ids.add(hint.chunkId);
      note.sourceChunkIds = Array.from(ids);
      rebuildNoteBodyText(plan, note);
      return;
    }
    case "unassign_chunk": {
      const targets = hint.noteClientId
        ? plan.notes.filter((n) => n.clientId === hint.noteClientId)
        : plan.notes;
      if (hint.noteClientId && targets.length === 0) {
        throw new Error(`Clarification patch: unknown note "${hint.noteClientId}"`);
      }
      for (const note of targets) {
        if (!note.sourceChunkIds) continue;
        const next = note.sourceChunkIds.filter((id) => id !== hint.chunkId);
        if (next.length === note.sourceChunkIds.length) continue;
        note.sourceChunkIds = next;
        rebuildNoteBodyText(plan, note);
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
  if (a.resolution === "skipped_best_judgement") {
    if (a.selectedOptionIds?.length || a.skipDefaultOptionId || a.otherText?.trim()) {
      return `Clarification "${c.title}": skipped_best_judgement cannot include explicit option/default/other text`;
    }
    return null;
  }
  if (a.resolution === "other_text") {
    const text = a.otherText?.trim() ?? "";
    if (text.length < OTHER_TEXT_MIN_LENGTH) {
      return `Clarification "${c.title}": otherText must be at least ${OTHER_TEXT_MIN_LENGTH} characters`;
    }
    if (a.selectedOptionIds?.length) {
      return `Clarification "${c.title}": other_text cannot include selectedOptionIds`;
    }
    if (a.skipDefaultOptionId) {
      return `Clarification "${c.title}": other_text cannot include skipDefaultOptionId`;
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

export function resolveOtherClarificationAnswers(
  plan: LoreImportPlan,
  answers: ClarificationAnswer[],
):
  | { status: "resolved"; answers: ClarificationAnswer[] }
  | { status: "needs_follow_up"; answers: ClarificationAnswer[]; followUp: ClarificationFollowUpPrompt } {
  const clarById = new Map(plan.clarifications.map((c) => [c.id, c]));
  const normalized = answers.map((a) => ({ ...a }));
  const unresolved: {
    index: number;
    clarification: LoreImportClarificationItem;
    otherText: string;
    scored: { id: string; label: string; recommended?: boolean; score: number }[];
    bestScore: number;
    confidence: number;
  }[] = [];

  for (let i = 0; i < normalized.length; i += 1) {
    const a = normalized[i]!;
    if (a.resolution === "skipped_best_judgement") {
      const c = clarById.get(a.clarificationId);
      if (!c) continue;
      normalized[i] = {
        clarificationId: a.clarificationId,
        resolution: "answered",
        selectedOptionIds: bestJudgementOptionIds(c),
      };
      continue;
    }
    if (a.resolution !== "other_text") continue;
    const c = clarById.get(a.clarificationId);
    if (!c) continue;
    const otherText = a.otherText?.trim() ?? "";
    if (otherText.length < OTHER_TEXT_MIN_LENGTH) continue;
    const scored = c.options
      .map((opt) => ({
        id: opt.id,
        label: opt.label,
        recommended: opt.recommended,
        score: scoreOptionForOtherText(opt.label, otherText),
      }))
      .sort((x, y) => y.score - x.score);
    const best = scored[0];
    const second = scored[1];
    const bestScore = best?.score ?? 0;
    const gap = bestScore - (second?.score ?? 0);
    const plannerConfidence = c.confidenceScore ?? 0.55;
    const confidence = Math.max(0, Math.min(1, Math.min(bestScore, plannerConfidence)));
    const clear =
      !!best &&
      (bestScore >= OTHER_RESOLVE_CLEAR_SCORE && gap >= OTHER_RESOLVE_CLEAR_GAP);
    if (clear) {
      normalized[i] = {
        clarificationId: a.clarificationId,
        resolution: "answered",
        selectedOptionIds: [best.id],
      };
      continue;
    }
    unresolved.push({
      index: i,
      clarification: c,
      otherText,
      scored,
      bestScore,
      confidence,
    });
  }

  if (unresolved.length === 0) {
    return { status: "resolved", answers: normalized };
  }

  unresolved.sort((a, b) => a.confidence - b.confidence);
  const target = unresolved[0]!;
  const topOptions = target.scored.slice(0, 4).map((o) => ({
    id: o.id,
    label: o.label,
    recommended: o.recommended,
  }));
  return {
    status: "needs_follow_up",
    answers: normalized,
    followUp: {
      clarificationId: target.clarification.id,
      title: target.clarification.title,
      question:
        "I could not confidently map your `Other` answer. Please choose the closest option, or skip this one and let the model use best judgement.",
      options: topOptions,
      confidence: target.confidence,
      otherText: target.otherText,
    },
  };
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
        : a.resolution === "skipped_best_judgement"
          ? bestJudgementOptionIds(c)
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
      confidenceScore:
        typeof o.confidenceScore === "number" && Number.isFinite(o.confidenceScore)
          ? Math.max(0, Math.min(1, o.confidenceScore))
          : typeof o.confidence === "number" && Number.isFinite(o.confidence)
            ? Math.max(0, Math.min(1, o.confidence))
            : undefined,
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
 * Deterministic "structure" clarifications produced when the outline model leaves
 * chunks unassigned, assigns the same chunk to multiple notes, or creates notes
 * without any matching chunks. Each item is marked `optional` so the importer
 * does not hard-block on them, but the UI will flag them.
 *
 * @see docs/LORE_IMPORT_AUDIT_2026-04-21.md §4.4 and plan §4.
 */
export function buildChunkAssignmentClarifications(input: {
  noteClientIdsWithoutChunks: string[];
  unassignedChunkIds: string[];
  duplicateAssignments: { chunkId: string; noteClientIds: string[] }[];
  notes: { clientId: string; title: string }[];
  chunks: { id: string; heading: string }[];
}): LoreImportClarificationItem[] {
  const out: LoreImportClarificationItem[] = [];
  const notesById = new Map(input.notes.map((n) => [n.clientId, n]));
  const chunksById = new Map(input.chunks.map((c) => [c.id, c]));

  // Cap the note list each clarification offers to keep option counts bounded.
  const MAX_NOTE_OPTIONS = 5;
  const noteOptions = input.notes.slice(0, MAX_NOTE_OPTIONS);

  for (const chunkId of input.unassignedChunkIds) {
    const chunk = chunksById.get(chunkId);
    if (!chunk) continue;
    if (noteOptions.length === 0) break;
    const options: LoreImportClarificationItem["options"] = [
      {
        id: "drop",
        label: "Leave this chunk only on the source card",
        recommended: true as const,
        planPatchHint: { op: "no_op" as const },
      },
      ...noteOptions.map((n) => ({
        id: `assign_${n.clientId}`,
        label: `Attach "${chunk.heading.slice(0, 80)}" to ${n.title}`,
        planPatchHint: {
          op: "assign_chunk_to_note" as const,
          chunkId,
          noteClientId: n.clientId,
        },
      })),
    ];
    const built = {
      id: randomUUID(),
      category: "structure" as const,
      severity: "optional" as const,
      confidenceScore: 0.7,
      title: `Unassigned chunk: "${chunk.heading.slice(0, 80)}"`,
      context:
        `The outline did not attach this chunk to any note. It still lives on the imported source card, ` +
        `but you can pin it to a specific note instead.`,
      questionKind: "single_select" as const,
      options: options.slice(0, 12),
    };
    const parsed = loreImportClarificationItemSchema.safeParse(built);
    if (parsed.success) out.push(parsed.data);
  }

  for (const dup of input.duplicateAssignments) {
    const chunk = chunksById.get(dup.chunkId);
    if (!chunk || dup.noteClientIds.length !== 2) continue;
    const claimants = dup.noteClientIds
      .map((id) => notesById.get(id))
      .filter((n): n is { clientId: string; title: string } => !!n);
    if (claimants.length !== 2) continue;
    const [a, b] = claimants as [typeof claimants[number], typeof claimants[number]];
    const options: LoreImportClarificationItem["options"] = [
      {
        id: "keep_both",
        label: "Keep the chunk on both notes",
        planPatchHint: { op: "no_op" as const },
      },
      {
        id: `keep_${a.clientId}`,
        label: `Keep only on ${a.title}`,
        recommended: true as const,
        planPatchHint: {
          op: "unassign_chunk" as const,
          chunkId: dup.chunkId,
          noteClientId: b.clientId,
        },
      },
      {
        id: `keep_${b.clientId}`,
        label: `Keep only on ${b.title}`,
        planPatchHint: {
          op: "unassign_chunk" as const,
          chunkId: dup.chunkId,
          noteClientId: a.clientId,
        },
      },
    ];
    const built = {
      id: randomUUID(),
      category: "structure" as const,
      severity: "optional" as const,
      confidenceScore: 0.66,
      title: `Chunk claimed by 2 notes`,
      context: `"${chunk.heading.slice(0, 80)}" is listed on ${a.title} and ${b.title}.`,
      questionKind: "single_select" as const,
      options,
      relatedNoteClientIds: [a.clientId, b.clientId],
    };
    const parsed = loreImportClarificationItemSchema.safeParse(built);
    if (parsed.success) out.push(parsed.data);
  }

  for (const noteClientId of input.noteClientIdsWithoutChunks) {
    const note = notesById.get(noteClientId);
    if (!note) continue;
    const options: LoreImportClarificationItem["options"] = [
      {
        id: "summary_only",
        label: "Keep this note as a summary-only stub",
        recommended: true as const,
        planPatchHint: { op: "no_op" as const },
      },
    ];
    for (const chunkId of input.unassignedChunkIds.slice(0, 5)) {
      const chunk = chunksById.get(chunkId);
      if (!chunk) continue;
      options.push({
        id: `attach_${chunkId}`,
        label: `Attach "${chunk.heading.slice(0, 80)}"`,
        planPatchHint: {
          op: "assign_chunk_to_note" as const,
          chunkId,
          noteClientId,
        },
      });
    }
    if (options.length < 2) continue;
    const built = {
      id: randomUUID(),
      category: "structure" as const,
      severity: "optional" as const,
      confidenceScore: 0.68,
      title: `Note "${note.title}" has no chunks`,
      context:
        `The outline mentioned this note but did not attach any source chunks. It will be written as a ` +
        `placeholder; attach a chunk or leave as a stub for now.`,
      questionKind: "single_select" as const,
      options: options.slice(0, 12),
      relatedNoteClientIds: [noteClientId],
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
        confidenceScore: 0.42,
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
        confidenceScore: 0.5,
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
