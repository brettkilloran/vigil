import { randomUUID } from "node:crypto";

import { finalizeHeartgardenSearchFiltersForDb } from "@/src/lib/heartgarden-search-tier-policy";
import { fetchDescendantSpaceIds } from "@/src/lib/heartgarden-space-subtree";
import type { CanonicalEntityKind } from "@/src/lib/lore-import-canonical-kinds";
import { chunkSourceText } from "@/src/lib/lore-import-chunk";
import {
  capClarificationList,
  ensureClarificationsForContradictions,
  normalizeClarificationsFromLlm,
  withoutLinkSemanticsClarifications,
} from "@/src/lib/lore-import-clarifications";
import { filterPlanLinksToSameCanvasSpace } from "@/src/lib/lore-import-item-link";
import { coerceImportLinkType } from "@/src/lib/lore-import-link-shape";
import { computeLoreImportPipelinePercent } from "@/src/lib/lore-import-pipeline-progress";

const SENTENCE_BOUNDARY_RE = /(?<=[.!?])\s+/;

import {
  attachBodiesToOutline,
  type CandidateRow,
  ensureOutlineHasFallbackNote,
  type LoreImportLlmCallEvent,
  renderStructuredBodyPlainText,
  runLoreImportClarifyLlm,
  runLoreImportMergeLlmBatched,
  runLoreImportOutlineLlm,
  type SpaceCandidateRow,
} from "@/src/lib/lore-import-plan-llm";
import type {
  IngestionSignals,
  LoreImportPlan,
  LoreImportUserContext,
} from "@/src/lib/lore-import-plan-types";
import { loreImportPlanSchema } from "@/src/lib/lore-import-plan-types";
import type { LoreImportProgressReporter } from "@/src/lib/lore-import-progress";
import {
  applyAllowedSpaceIdsToFilters,
  buildSpacePath,
  loadSpaceMapForLoreImportPathLabels,
} from "@/src/lib/lore-import-space-scope";
import { LOCATION_TOP_FIELD_CHAR_CAPS } from "@/src/lib/lore-location-focus-document-html";
import type { SearchFilters, VigilDb } from "@/src/lib/spaces";
import { hybridRetrieveItems } from "@/src/lib/vault-retrieval";
import { IMPORT_MERGE_HYBRID_OPTIONS } from "@/src/lib/vault-retrieval-profiles";

const GM_LORE_IMPORT_SEARCH = { role: "gm" } as const;

const VAULT_SEARCH_CONCURRENCY = 5;

interface OutlineNoteInternal {
  body?: import("@/src/lib/lore-import-plan-types").LoreImportStructuredBody;
  bodyText: string;
  campaignEpoch?: number;
  canonicalEntityKind: CanonicalEntityKind;
  clientId: string;
  folderClientId: string | null;
  ingestionSignals?: IngestionSignals;
  loreHistorical?: boolean;
  sourceChunkIds: string[];
  sourcePassages: { chunkId: string; quote: string }[];
  summary: string;
  title: string;
}

export interface LoreImportPlanEvent {
  durationMs?: number;
  kind:
    | "phase_start"
    | "phase_end"
    | "llm_call"
    | "vault_search"
    | "warning"
    | "note";
  model?: string;
  phase?: string;
  ref?: string;
  responseSnippet?: string;
  stopReason?: string | null;
  text?: string;
  tokensIn?: number | null;
  tokensOut?: number | null;
}

interface LoreImportFindings {
  candidateSpaces: number;
  candidates: number;
  chunks: number;
  clarifications: number;
  contradictions: number;
  folders: number;
  mergeProposals: number;
  notes: number;
  targetSpaceRoutes: number;
}

type LoreImportPlanEventReporter = (
  event: LoreImportPlanEvent
) => void | Promise<void>;

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: lore import plan-build merges LLM response with local placement heuristics
export async function buildLoreImportPlan(args: {
  db: VigilDb;
  spaceId: string;
  apiKey: string;
  model: string;
  fullText: string;
  importBatchId: string;
  fileName?: string;
  userContext?: LoreImportUserContext;
  onProgress?: LoreImportProgressReporter;
  onEvent?: LoreImportPlanEventReporter;
}): Promise<LoreImportPlan> {
  let currentPhase: string | null = null;
  let currentPhaseStartedAt = 0;
  let findings: LoreImportFindings = {
    candidateSpaces: 0,
    candidates: 0,
    chunks: 0,
    clarifications: 0,
    contradictions: 0,
    folders: 0,
    mergeProposals: 0,
    notes: 0,
    targetSpaceRoutes: 0,
  };
  const emitEvent = async (event: LoreImportPlanEvent): Promise<void> => {
    await args.onEvent?.(event);
  };
  const beginPhaseIfNeeded = async (nextPhase: string): Promise<void> => {
    if (!nextPhase) {
      return;
    }
    if (currentPhase === nextPhase) {
      return;
    }
    const now = Date.now();
    if (currentPhase) {
      await emitEvent({
        durationMs: Math.max(0, now - currentPhaseStartedAt),
        kind: "phase_end",
        phase: currentPhase,
        text: `${currentPhase} completed`,
      });
    }
    currentPhase = nextPhase;
    currentPhaseStartedAt = now;
    await emitEvent({
      kind: "phase_start",
      phase: nextPhase,
      text: `${nextPhase} started`,
    });
  };
  const flushCurrentPhase = async (): Promise<void> => {
    if (!currentPhase) {
      return;
    }
    const now = Date.now();
    await emitEvent({
      durationMs: Math.max(0, now - currentPhaseStartedAt),
      kind: "phase_end",
      phase: currentPhase,
      text: `${currentPhase} completed`,
    });
    currentPhase = null;
    currentPhaseStartedAt = 0;
  };
  const emitLlmCall = async (
    event: LoreImportLlmCallEvent,
    phase: string
  ): Promise<void> => {
    await emitEvent({
      durationMs: event.durationMs,
      kind: "llm_call",
      model: event.model,
      phase,
      responseSnippet: event.responseSnippet,
      stopReason: event.stopReason ?? null,
      text: event.label,
      tokensIn: event.inputTokens ?? null,
      tokensOut: event.outputTokens ?? null,
    });
  };
  const reportProgress = async (
    phase: string,
    message: string,
    detail?: {
      step?: number;
      total?: number;
      phaseFraction?: number;
      meta?: Record<string, unknown>;
    }
  ) => {
    await beginPhaseIfNeeded(phase);
    const pipelinePercent =
      computeLoreImportPipelinePercent(phase, {
        phaseFraction: detail?.phaseFraction,
        step: detail?.step,
        total: detail?.total,
      }) ?? 8;
    await args.onProgress?.({
      message,
      meta: { ...detail?.meta, findings, pipelinePercent },
      phase,
      step: detail?.step,
      total: detail?.total,
    });
  };
  await reportProgress("chunking", "Splitting source text into import chunks", {
    phaseFraction: 1,
  });
  const chunks = chunkSourceText(args.fullText);
  await reportProgress("outline", "Generating initial folder/note outline", {
    meta: { subphase: "drafting" },
    phaseFraction: 0.12,
  });
  const outline = await runLoreImportOutlineLlm(
    args.apiKey,
    args.model,
    chunks,
    args.fullText,
    args.userContext,
    async (event) => {
      await emitLlmCall(event, "outline");
    }
  );
  await reportProgress(
    "outline",
    "Outline generated; attaching chunk-backed note bodies",
    {
      meta: { subphase: "parsing" },
      phaseFraction: 0.92,
    }
  );
  await reportProgress("outline", "Attaching chunk-backed note bodies", {
    meta: { subphase: "attaching_bodies" },
    phaseFraction: 0.96,
  });
  ensureOutlineHasFallbackNote(outline, chunks);
  const chunkDiagnostics = attachBodiesToOutline(outline, chunks);
  findings = {
    ...findings,
    chunks: chunks.length,
    folders: outline.folders.length,
    notes: outline.notes.length,
  };
  if (chunkDiagnostics.unassignedChunkIds.length > 0) {
    await emitEvent({
      kind: "warning",
      phase: "outline",
      ref: chunkDiagnostics.unassignedChunkIds[0],
      text: `Unassigned chunks detected (${chunkDiagnostics.unassignedChunkIds.length})`,
    });
  }
  if (chunkDiagnostics.noteClientIdsWithoutChunks.length > 0) {
    await emitEvent({
      kind: "warning",
      phase: "outline",
      ref: chunkDiagnostics.noteClientIdsWithoutChunks[0],
      text: `Notes without chunk assignments (${chunkDiagnostics.noteClientIdsWithoutChunks.length})`,
    });
  }
  const locationTopFieldTrimWarnings: string[] = [];

  const notesInternal: OutlineNoteInternal[] = outline.notes.map((n) => ({
    ...(() => {
      const locationTrimFields =
        n.body && n.body.kind === "location"
          ? ((
              n.body as typeof n.body & {
                __locationTopFieldTrimmedFields?: Array<
                  "name" | "context" | "detail"
                >;
              }
            ).__locationTopFieldTrimmedFields ?? [])
          : [];
      for (const field of locationTrimFields) {
        locationTopFieldTrimWarnings.push(
          `Location "${n.title}" ${field} exceeded ${LOCATION_TOP_FIELD_CHAR_CAPS[field]} chars and was trimmed during import.`
        );
      }
      return n;
    })(),
    bodyText:
      renderStructuredBodyPlainText(n.body).slice(0, 120_000) ||
      String((n as { bodyText?: string }).bodyText ?? "").slice(0, 120_000),
  }));
  const titleByClientId = new Map(
    notesInternal.map((n) => [n.clientId, n.title])
  );
  for (const dup of chunkDiagnostics.duplicateQuotePassages) {
    if (dup.noteClientIds.length <= 1) {
      continue;
    }
    const primaryId = dup.noteClientIds[0]!;
    const primaryTitle = titleByClientId.get(primaryId) ?? "Related note";
    const shortMention =
      dup.quote.split(SENTENCE_BOUNDARY_RE)[0]?.slice(0, 180) ??
      dup.quote.slice(0, 180);
    for (const noteId of dup.noteClientIds.slice(1)) {
      const note = notesInternal.find((n) => n.clientId === noteId);
      if (!note) {
        continue;
      }
      note.sourcePassages = (note.sourcePassages ?? []).filter(
        (sp) => sp.quote.replace(/\s+/g, " ").trim() !== dup.quote
      );
      // REVIEW_2026-04-25_1730 H6: emit a bold cross-reference instead of
      // a `[[Title]]` marker; the wiki-link assist that resolved those
      // markers no longer exists.
      const refLine = `**See:** ${primaryTitle}`;
      if (!note.bodyText.includes(refLine)) {
        note.bodyText = `${note.bodyText}\n\n${shortMention} ${refLine}`.slice(
          0,
          120_000
        );
      }
    }
  }

  const importScope = args.userContext?.importScope ?? "current_subtree";
  const allowedSpaceIds =
    importScope === "current_subtree"
      ? await fetchDescendantSpaceIds(args.db, args.spaceId)
      : null;
  const baseVaultSearchFilters: SearchFilters =
    (await finalizeHeartgardenSearchFiltersForDb(
      args.db,
      GM_LORE_IMPORT_SEARCH,
      {}
    )) ?? {};
  const vaultSearchFilters: SearchFilters = applyAllowedSpaceIdsToFilters(
    baseVaultSearchFilters,
    allowedSpaceIds
  );
  const spaceById = await loadSpaceMapForLoreImportPathLabels({
    db: args.db,
    importScope,
    rootSpaceId: args.spaceId,
  });

  const candidatesByNoteClientId: Record<string, CandidateRow[]> = {};
  const relatedItemsByNoteClientId: Record<
    string,
    {
      itemId: string;
      spaceId: string;
      title: string;
      score?: number;
      snippet?: string;
    }[]
  > = {};
  const spaceCandidatesByNoteClientId: Record<string, SpaceCandidateRow[]> = {};
  const globalSpaceSuggestions = new Map<
    string,
    {
      spaceId: string;
      spaceTitle: string;
      path?: string;
      score: number;
      reason?: string;
    }
  >();
  const retrievalTotal = Math.max(
    1,
    Math.ceil(notesInternal.length / VAULT_SEARCH_CONCURRENCY)
  );
  for (let i = 0; i < notesInternal.length; i += VAULT_SEARCH_CONCURRENCY) {
    const retrievalStep = Math.floor(i / VAULT_SEARCH_CONCURRENCY) + 1;
    await reportProgress(
      "vault_retrieval",
      "Searching existing vault candidates",
      {
        step: retrievalStep,
        total: retrievalTotal,
      }
    );
    const retrievalStartedAt = Date.now();
    const slice = notesInternal.slice(i, i + VAULT_SEARCH_CONCURRENCY);
    const results = await Promise.all(
      slice.map(async (n) => {
        const q = `${n.title} ${n.summary}`.trim().slice(0, 800);
        const hybrid = await hybridRetrieveItems(
          args.db,
          q,
          vaultSearchFilters,
          {
            ...IMPORT_MERGE_HYBRID_OPTIONS,
            includeVector: true,
          }
        );
        const rows = hybrid.rows.map((r) => {
          const snippet =
            hybrid.itemIdToFtsSnippet.get(r.item.id) ??
            hybrid.itemIdToChunks.get(r.item.id)?.[0] ??
            undefined;
          return {
            entityType: r.item.entityType,
            itemId: r.item.id,
            itemType: r.item.itemType,
            snippet,
            spaceId: r.space.id,
            spaceName: r.space.name,
            title: r.item.title ?? "",
          };
        });
        const relatedItems = hybrid.rows.slice(0, 12).map((r) => ({
          itemId: r.item.id,
          score:
            typeof r.score === "number"
              ? Math.max(0, Math.min(1, r.score))
              : undefined,
          snippet:
            hybrid.itemIdToFtsSnippet.get(r.item.id)?.slice(0, 1200) ??
            hybrid.itemIdToChunks.get(r.item.id)?.[0]?.slice(0, 1200),
          spaceId: r.space.id,
          title: (r.item.title ?? "").slice(0, 255),
        }));
        const bySpace = new Map<
          string,
          { spaceTitle: string; score: number; topTitles: string[] }
        >();
        for (const row of hybrid.rows) {
          const entry = bySpace.get(row.space.id) ?? {
            score: 0,
            spaceTitle: row.space.name,
            topTitles: [],
          };
          entry.score += typeof row.score === "number" ? row.score : 0;
          if (entry.topTitles.length < 3) {
            const title = (row.item.title ?? "").trim();
            if (title) {
              entry.topTitles.push(title.slice(0, 255));
            }
          }
          bySpace.set(row.space.id, entry);
        }
        const spaceCandidates = [...bySpace.entries()]
          .sort((a, b) => b[1].score - a[1].score)
          .slice(0, 5)
          .map(([spaceId, entry]) => {
            const path = buildSpacePath(spaceId, spaceById);
            const score = Math.max(0, Math.min(1, entry.score));
            return {
              path: path || undefined,
              reason:
                entry.topTitles.length > 0
                  ? `Related cards: ${entry.topTitles.join(", ")}`
                  : undefined,
              score,
              spaceId,
              spaceTitle: entry.spaceTitle.slice(0, 255),
              topTitles: entry.topTitles,
            };
          });
        return { clientId: n.clientId, relatedItems, rows, spaceCandidates };
      })
    );
    for (const r of results) {
      candidatesByNoteClientId[r.clientId] = r.rows;
      relatedItemsByNoteClientId[r.clientId] = r.relatedItems;
      spaceCandidatesByNoteClientId[r.clientId] = r.spaceCandidates;
      for (const candidate of r.spaceCandidates) {
        const existing = globalSpaceSuggestions.get(candidate.spaceId);
        if (!existing || (candidate.score ?? 0) > existing.score) {
          globalSpaceSuggestions.set(candidate.spaceId, {
            path: candidate.path,
            reason: candidate.reason,
            score: candidate.score ?? 0,
            spaceId: candidate.spaceId,
            spaceTitle: candidate.spaceTitle,
          });
        }
      }
    }
    findings = {
      ...findings,
      candidateSpaces: globalSpaceSuggestions.size,
      candidates: Object.values(candidatesByNoteClientId).reduce(
        (sum, rows) => sum + rows.length,
        0
      ),
    };
    await emitEvent({
      durationMs: Math.max(0, Date.now() - retrievalStartedAt),
      kind: "vault_search",
      phase: "vault_retrieval",
      text: `Vault retrieval batch ${retrievalStep} of ${retrievalTotal}`,
    });
  }
  if (importScope === "current_subtree" && globalSpaceSuggestions.size === 0) {
    await emitEvent({
      kind: "warning",
      phase: "vault_retrieval",
      text: "No placement candidates found in current subtree scope.",
    });
  }

  const mergeInput = notesInternal.map((n) => ({
    bodyPreview: n.bodyText.slice(0, 3500),
    clientId: n.clientId,
    summary: n.summary,
    title: n.title,
  }));
  await reportProgress("merge", "Comparing import notes with candidate cards", {
    meta: { subphase: "candidate_match" },
    phaseFraction: 0.08,
  });

  const {
    mergeProposals: rawMerges,
    contradictions: rawContra,
    targetSpaces: rawTargetSpaces,
  } = await runLoreImportMergeLlmBatched(
    args.apiKey,
    args.model,
    mergeInput,
    candidatesByNoteClientId,
    spaceCandidatesByNoteClientId,
    async (step, total) => {
      await reportProgress("merge", "Running merge analysis batches", {
        meta: {
          subphase: `batch ${step} of ${total}`,
        },
        step,
        total,
      });
    },
    async (event) => {
      await emitLlmCall(event, "merge");
    }
  );
  const targetSpaceByNoteClientId = new Map(
    rawTargetSpaces.map((row) => [row.noteClientId, row])
  );

  const mergeProposals = rawMerges.map((m) => {
    const row = candidatesByNoteClientId[m.noteClientId]?.find(
      (c) => c.itemId === m.targetItemId
    );
    return {
      id: randomUUID(),
      noteClientId: m.noteClientId,
      proposedText: m.proposedText,
      rationale: m.rationale,
      strategy: m.strategy,
      targetEntityType: row?.entityType ?? null,
      targetItemId: m.targetItemId,
      targetItemType: row?.itemType ?? null,
      targetSpaceName: row?.spaceName,
      targetTitle: row?.title ?? "Item",
    };
  });

  const contradictions = rawContra.map((c) => ({
    details: c.details,
    id: randomUUID(),
    noteClientId: c.noteClientId,
    summary: c.summary,
  }));
  findings = {
    ...findings,
    contradictions: contradictions.length,
    mergeProposals: mergeProposals.length,
    targetSpaceRoutes: rawTargetSpaces.filter((row) => row.targetSpaceId)
      .length,
  };

  const kindByClientId = new Map(
    notesInternal.map((n) => [n.clientId, n.canonicalEntityKind])
  );
  const impliedBindingLinks = notesInternal
    .map((n) => {
      if (n.body?.kind !== "character") {
        return null;
      }
      const target = n.body.affiliationFactionClientId?.trim();
      if (!target) {
        return null;
      }
      if (!notesInternal.some((candidate) => candidate.clientId === target)) {
        return null;
      }
      return {
        fromClientId: n.clientId,
        linkIntent: "binding_hint" as const,
        linkType: "alliance",
        toClientId: target,
      };
    })
    .filter(
      (
        l
      ): l is {
        fromClientId: string;
        toClientId: string;
        linkType: string;
        linkIntent: "binding_hint";
      } => Boolean(l)
    );
  const coercionWarnings: string[] = [];
  const shapedOutlineLinks = [...outline.links, ...impliedBindingLinks].map(
    (l) => {
      const fromKind = kindByClientId.get(l.fromClientId);
      const toKind = kindByClientId.get(l.toClientId);
      const coerced = coerceImportLinkType(fromKind, toKind, l.linkType);
      if (coerced.coerced && coerced.reason) {
        coercionWarnings.push(
          `Link ${l.fromClientId} → ${l.toClientId}: ${coerced.reason}`
        );
      }
      return {
        fromClientId: l.fromClientId,
        linkIntent: l.linkIntent,
        linkType: coerced.linkType,
        toClientId: l.toClientId,
      };
    }
  );

  const {
    links: coLocatedLinks,
    crossSpaceMentions,
    warnings: linkWarnings,
  } = filterPlanLinksToSameCanvasSpace(
    notesInternal.map((n) => ({
      clientId: n.clientId,
      folderClientId: n.folderClientId,
    })),
    shapedOutlineLinks
  );
  for (const warning of locationTopFieldTrimWarnings) {
    await emitEvent({
      kind: "warning",
      phase: "outline",
      text: warning,
    });
  }
  for (const warning of coercionWarnings) {
    await emitEvent({
      kind: "warning",
      phase: "merge",
      text: warning,
    });
  }
  for (const warning of linkWarnings) {
    await emitEvent({
      kind: "warning",
      phase: "merge",
      text: warning,
    });
  }

  // Group cross-space drafts by source note so we can attach mention arrays and
  // append a readable "Related" footer (plain titles, no `[[...]]` markers).
  //
  // REVIEW_2026-04-25_1730 H6: previously this emitted `[[Title]]` markers
  // inline. The wiki-link typing assist that resolved those markers has been
  // removed, so they were rendering as raw `[[…]]` strings in the editor.
  // The Alt-hover discovery surface + entity_mentions now cover the
  // cross-folder affordance, so we just inline the bare titles here and
  // keep the structured `crossFolderMentions` for downstream wiring.
  const mentionsBySource = new Map<
    string,
    {
      toClientId: string;
      targetTitle: string;
      linkType: string;
      linkIntent?: "association" | "binding_hint";
    }[]
  >();
  for (const m of crossSpaceMentions) {
    const targetTitle = titleByClientId.get(m.toClientId);
    if (!targetTitle) {
      continue;
    }
    const list = mentionsBySource.get(m.fromClientId) ?? [];
    list.push({
      linkIntent: m.linkIntent,
      linkType: m.linkType ?? "history",
      targetTitle,
      toClientId: m.toClientId,
    });
    mentionsBySource.set(m.fromClientId, list);
  }
  for (const n of notesInternal) {
    const mentions = mentionsBySource.get(n.clientId);
    if (!mentions || mentions.length === 0) {
      continue;
    }
    const titles = mentions.map((m) => m.targetTitle).join(", ");
    const appended = `\n\n**Related (in other folders):** ${titles}`;
    n.bodyText = (n.bodyText + appended).slice(0, 120_000);
    (n as { crossFolderMentions?: typeof mentions }).crossFolderMentions =
      mentions;
  }

  const clarifyPayload = {
    chunks: chunks.map((c) => ({
      excerpt: args.fullText.slice(
        c.charStart,
        Math.min(c.charEnd, c.charStart + 2400)
      ),
      heading: c.heading,
      id: c.id,
    })),
    contradictions: contradictions.map((c) => ({
      details: c.details,
      id: c.id,
      noteClientId: c.noteClientId,
      summary: c.summary,
    })),
    folders: outline.folders.map((f) => ({
      clientId: f.clientId,
      parentClientId: f.parentClientId,
      title: f.title,
    })),
    links: coLocatedLinks,
    mergeProposals: mergeProposals.map((m) => ({
      id: m.id,
      noteClientId: m.noteClientId,
      rationale: m.rationale,
      strategy: m.strategy,
      targetItemId: m.targetItemId,
      targetTitle: m.targetTitle,
    })),
    notes: notesInternal.map((n) => ({
      canonicalEntityKind: n.canonicalEntityKind,
      clientId: n.clientId,
      folderClientId: n.folderClientId,
      ingestionSignals: n.ingestionSignals,
      loreHistorical: n.loreHistorical,
      summary: n.summary.slice(0, 600),
      title: n.title,
    })),
  };

  await reportProgress(
    "clarify",
    "Generating contradiction and clarification questions",
    {
      phaseFraction: 0.12,
    }
  );
  const clarifyRaw = await runLoreImportClarifyLlm(
    args.apiKey,
    args.model,
    clarifyPayload,
    async (event) => {
      await emitLlmCall(event, "clarify");
    }
  );
  await reportProgress("clarify", "Consolidating review questions", {
    phaseFraction: 0.95,
  });
  let clarifications = normalizeClarificationsFromLlm(clarifyRaw);
  clarifications = ensureClarificationsForContradictions(
    contradictions,
    mergeProposals,
    clarifications
  );
  clarifications = capClarificationList(clarifications);
  clarifications = withoutLinkSemanticsClarifications(clarifications);
  findings = {
    ...findings,
    clarifications: clarifications.length,
  };

  const planRaw: LoreImportPlan = {
    chunks: chunks.map((c) => ({
      body: c.body.slice(0, 32_000),
      charEnd: c.charEnd,
      charStart: c.charStart,
      heading: c.heading,
      id: c.id,
    })),
    clarifications,
    contradictions,
    fileName: args.fileName,
    folders: outline.folders.map((f) => ({
      clientId: f.clientId,
      parentClientId: f.parentClientId,
      title: f.title,
    })),
    importBatchId: args.importBatchId,
    importPlanWarnings:
      linkWarnings.length > 0 ||
      coercionWarnings.length > 0 ||
      locationTopFieldTrimWarnings.length > 0
        ? [
            ...locationTopFieldTrimWarnings,
            ...coercionWarnings,
            ...linkWarnings,
          ]
        : undefined,
    links: coLocatedLinks.map((l) => ({
      fromClientId: l.fromClientId,
      linkType: l.linkType,
      toClientId: l.toClientId,
      ...(l.linkIntent ? { linkIntent: l.linkIntent } : {}),
    })),
    mergeProposals,
    notes: notesInternal.map((n) => {
      const mentions = (
        n as {
          crossFolderMentions?: {
            toClientId: string;
            targetTitle: string;
            linkType: string;
            linkIntent?: "association" | "binding_hint";
          }[];
        }
      ).crossFolderMentions;
      const targetSpace = targetSpaceByNoteClientId.get(n.clientId);
      const relatedItems = relatedItemsByNoteClientId[n.clientId] ?? [];
      return {
        bodyText: n.bodyText,
        campaignEpoch: n.campaignEpoch,
        canonicalEntityKind: n.canonicalEntityKind,
        clientId: n.clientId,
        folderClientId: n.folderClientId,
        ingestionSignals: n.ingestionSignals,
        loreHistorical: n.loreHistorical,
        sourceChunkIds: n.sourceChunkIds,
        sourcePassages: n.sourcePassages,
        summary: n.summary,
        targetItemType: null,
        title: n.title,
        ...(n.body ? { body: n.body } : {}),
        ...(typeof targetSpace?.targetSpaceId === "string"
          ? { targetSpaceId: targetSpace.targetSpaceId }
          : {}),
        ...(typeof targetSpace?.confidence === "number"
          ? { targetSpaceConfidence: targetSpace.confidence }
          : {}),
        ...(targetSpace?.reason
          ? { targetSpaceReason: targetSpace.reason }
          : {}),
        ...(relatedItems.length > 0 ? { relatedItems } : {}),
        ...(mentions && mentions.length > 0
          ? { crossFolderMentions: mentions }
          : {}),
      };
    }),
    sourceCharCount: args.fullText.length,
    spaceSuggestions:
      globalSpaceSuggestions.size > 0
        ? [...globalSpaceSuggestions.values()]
            .sort((a, b) => b.score - a.score)
            .slice(0, 25)
            .map((row) => ({
              path: row.path,
              reason: row.reason,
              score: row.score,
              spaceId: row.spaceId,
              spaceTitle: row.spaceTitle,
            }))
        : undefined,
    userContext: args.userContext,
  };

  const parsed = loreImportPlanSchema.safeParse(planRaw);
  if (!parsed.success) {
    await flushCurrentPhase();
    throw new Error(`Plan validation failed: ${parsed.error.message}`);
  }
  await reportProgress("finalize", "Finalizing validated import plan", {
    phaseFraction: 1,
  });
  await flushCurrentPhase();
  return parsed.data;
}
