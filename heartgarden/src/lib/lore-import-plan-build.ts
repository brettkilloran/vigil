import { randomUUID } from "crypto";

import type { CanonicalEntityKind } from "@/src/lib/lore-import-canonical-kinds";
import { chunkSourceText } from "@/src/lib/lore-import-chunk";
import {
  attachBodiesToOutline,
  ensureOutlineHasFallbackNote,
  renderStructuredBodyPlainText,
  type LoreImportLlmCallEvent,
  runLoreImportClarifyLlm,
  runLoreImportMergeLlmBatched,
  runLoreImportOutlineLlm,
  type CandidateRow,
  type SpaceCandidateRow,
} from "@/src/lib/lore-import-plan-llm";
import {
  capClarificationList,
  ensureClarificationsForContradictions,
  normalizeClarificationsFromLlm,
  withoutLinkSemanticsClarifications,
} from "@/src/lib/lore-import-clarifications";
import { filterPlanLinksToSameCanvasSpace } from "@/src/lib/lore-import-item-link";
import { coerceImportLinkType } from "@/src/lib/lore-import-link-shape";
import type { LoreImportProgressReporter } from "@/src/lib/lore-import-progress";
import { computeLoreImportPipelinePercent } from "@/src/lib/lore-import-pipeline-progress";
import type {
  IngestionSignals,
  LoreImportPlan,
  LoreImportUserContext,
} from "@/src/lib/lore-import-plan-types";
import { loreImportPlanSchema } from "@/src/lib/lore-import-plan-types";
import { LOCATION_TOP_FIELD_CHAR_CAPS } from "@/src/lib/lore-location-focus-document-html";
import { finalizeHeartgardenSearchFiltersForDb } from "@/src/lib/heartgarden-search-tier-policy";
import { fetchDescendantSpaceIds } from "@/src/lib/heartgarden-space-subtree";
import {
  applyAllowedSpaceIdsToFilters,
  buildSpacePath,
  loadSpaceMapForLoreImportPathLabels,
} from "@/src/lib/lore-import-space-scope";
import type { SearchFilters, VigilDb } from "@/src/lib/spaces";
import { IMPORT_MERGE_HYBRID_OPTIONS } from "@/src/lib/vault-retrieval-profiles";
import { hybridRetrieveItems } from "@/src/lib/vault-retrieval";

const GM_LORE_IMPORT_SEARCH = { role: "gm" } as const;

const VAULT_SEARCH_CONCURRENCY = 5;

type OutlineNoteInternal = {
  clientId: string;
  title: string;
  canonicalEntityKind: CanonicalEntityKind;
  summary: string;
  folderClientId: string | null;
  sourceChunkIds: string[];
  sourcePassages: { chunkId: string; quote: string }[];
  body?: import("@/src/lib/lore-import-plan-types").LoreImportStructuredBody;
  ingestionSignals?: IngestionSignals;
  campaignEpoch?: number;
  loreHistorical?: boolean;
  bodyText: string;
};

export type LoreImportPlanEvent = {
  phase?: string;
  kind:
    | "phase_start"
    | "phase_end"
    | "llm_call"
    | "vault_search"
    | "warning"
    | "note";
  durationMs?: number;
  model?: string;
  tokensIn?: number | null;
  tokensOut?: number | null;
  stopReason?: string | null;
  responseSnippet?: string;
  text?: string;
  ref?: string;
};

type LoreImportFindings = {
  chunks: number;
  folders: number;
  notes: number;
  candidates: number;
  candidateSpaces: number;
  mergeProposals: number;
  contradictions: number;
  clarifications: number;
  targetSpaceRoutes: number;
};

type LoreImportPlanEventReporter = (
  event: LoreImportPlanEvent,
) => void | Promise<void>;

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
    chunks: 0,
    folders: 0,
    notes: 0,
    candidates: 0,
    candidateSpaces: 0,
    mergeProposals: 0,
    contradictions: 0,
    clarifications: 0,
    targetSpaceRoutes: 0,
  };
  const emitEvent = async (event: LoreImportPlanEvent): Promise<void> => {
    await args.onEvent?.(event);
  };
  const beginPhaseIfNeeded = async (nextPhase: string): Promise<void> => {
    if (!nextPhase) return;
    if (currentPhase === nextPhase) return;
    const now = Date.now();
    if (currentPhase) {
      await emitEvent({
        kind: "phase_end",
        phase: currentPhase,
        durationMs: Math.max(0, now - currentPhaseStartedAt),
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
    if (!currentPhase) return;
    const now = Date.now();
    await emitEvent({
      kind: "phase_end",
      phase: currentPhase,
      durationMs: Math.max(0, now - currentPhaseStartedAt),
      text: `${currentPhase} completed`,
    });
    currentPhase = null;
    currentPhaseStartedAt = 0;
  };
  const emitLlmCall = async (
    event: LoreImportLlmCallEvent,
    phase: string,
  ): Promise<void> => {
    await emitEvent({
      kind: "llm_call",
      phase,
      durationMs: event.durationMs,
      model: event.model,
      tokensIn: event.inputTokens ?? null,
      tokensOut: event.outputTokens ?? null,
      stopReason: event.stopReason ?? null,
      responseSnippet: event.responseSnippet,
      text: event.label,
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
    },
  ) => {
    await beginPhaseIfNeeded(phase);
    const pipelinePercent =
      computeLoreImportPipelinePercent(phase, {
        step: detail?.step,
        total: detail?.total,
        phaseFraction: detail?.phaseFraction,
      }) ?? 8;
    await args.onProgress?.({
      phase,
      message,
      step: detail?.step,
      total: detail?.total,
      meta: { ...detail?.meta, pipelinePercent, findings },
    });
  };
  await reportProgress("chunking", "Splitting source text into import chunks", {
    phaseFraction: 1,
  });
  const chunks = chunkSourceText(args.fullText);
  await reportProgress("outline", "Generating initial folder/note outline", {
    phaseFraction: 0.12,
    meta: { subphase: "drafting" },
  });
  const outline = await runLoreImportOutlineLlm(
    args.apiKey,
    args.model,
    chunks,
    args.fullText,
    args.userContext,
    async (event) => {
      await emitLlmCall(event, "outline");
    },
  );
  await reportProgress("outline", "Outline generated; attaching chunk-backed note bodies", {
    phaseFraction: 0.92,
    meta: { subphase: "parsing" },
  });
  await reportProgress("outline", "Attaching chunk-backed note bodies", {
    phaseFraction: 0.96,
    meta: { subphase: "attaching_bodies" },
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
      text: `Unassigned chunks detected (${chunkDiagnostics.unassignedChunkIds.length})`,
      ref: chunkDiagnostics.unassignedChunkIds[0],
    });
  }
  if (chunkDiagnostics.noteClientIdsWithoutChunks.length > 0) {
    await emitEvent({
      kind: "warning",
      phase: "outline",
      text: `Notes without chunk assignments (${chunkDiagnostics.noteClientIdsWithoutChunks.length})`,
      ref: chunkDiagnostics.noteClientIdsWithoutChunks[0],
    });
  }
  const locationTopFieldTrimWarnings: string[] = [];

  const notesInternal: OutlineNoteInternal[] = outline.notes.map((n) => ({
    ...(function () {
      const locationTrimFields =
        n.body && n.body.kind === "location"
          ? (
              n.body as typeof n.body & {
                __locationTopFieldTrimmedFields?: Array<"name" | "context" | "detail">;
              }
            ).__locationTopFieldTrimmedFields ?? []
          : [];
      for (const field of locationTrimFields) {
        locationTopFieldTrimWarnings.push(
          `Location "${n.title}" ${field} exceeded ${LOCATION_TOP_FIELD_CHAR_CAPS[field]} chars and was trimmed during import.`,
        );
      }
      return n;
    })(),
    bodyText:
      renderStructuredBodyPlainText(n.body).slice(0, 120_000) ||
      String((n as { bodyText?: string }).bodyText ?? "").slice(0, 120_000),
  }));
  const titleByClientId = new Map(notesInternal.map((n) => [n.clientId, n.title]));
  for (const dup of chunkDiagnostics.duplicateQuotePassages) {
    if (dup.noteClientIds.length <= 1) continue;
    const primaryId = dup.noteClientIds[0]!;
    const primaryTitle = titleByClientId.get(primaryId) ?? "Related note";
    const shortMention = dup.quote.split(/(?<=[.!?])\s+/)[0]?.slice(0, 180) ?? dup.quote.slice(0, 180);
    for (const noteId of dup.noteClientIds.slice(1)) {
      const note = notesInternal.find((n) => n.clientId === noteId);
      if (!note) continue;
      note.sourcePassages = (note.sourcePassages ?? []).filter(
        (sp) => sp.quote.replace(/\s+/g, " ").trim() !== dup.quote,
      );
      if (!note.bodyText.includes(`[[${primaryTitle}]]`)) {
        note.bodyText = `${note.bodyText}\n\n${shortMention} [[${primaryTitle}]]`.slice(0, 120_000);
      }
    }
  }

  const importScope = args.userContext?.importScope ?? "current_subtree";
  const allowedSpaceIds =
    importScope === "current_subtree"
      ? await fetchDescendantSpaceIds(args.db, args.spaceId)
      : null;
  const baseVaultSearchFilters: SearchFilters =
    (await finalizeHeartgardenSearchFiltersForDb(args.db, GM_LORE_IMPORT_SEARCH, {})) ?? {};
  const vaultSearchFilters: SearchFilters = applyAllowedSpaceIdsToFilters(
    baseVaultSearchFilters,
    allowedSpaceIds,
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
    { spaceId: string; spaceTitle: string; path?: string; score: number; reason?: string }
  >();
  const retrievalTotal = Math.max(
    1,
    Math.ceil(notesInternal.length / VAULT_SEARCH_CONCURRENCY),
  );
  for (let i = 0; i < notesInternal.length; i += VAULT_SEARCH_CONCURRENCY) {
    const retrievalStep = Math.floor(i / VAULT_SEARCH_CONCURRENCY) + 1;
    await reportProgress("vault_retrieval", "Searching existing vault candidates", {
      step: retrievalStep,
      total: retrievalTotal,
    });
    const retrievalStartedAt = Date.now();
    const slice = notesInternal.slice(i, i + VAULT_SEARCH_CONCURRENCY);
    const results = await Promise.all(
      slice.map(async (n) => {
        const q = `${n.title} ${n.summary}`.trim().slice(0, 800);
        const hybrid = await hybridRetrieveItems(args.db, q, vaultSearchFilters, {
          ...IMPORT_MERGE_HYBRID_OPTIONS,
          includeVector: true,
        });
        const rows = hybrid.rows.map((r) => {
          const snippet =
            hybrid.itemIdToFtsSnippet.get(r.item.id) ??
            (hybrid.itemIdToChunks.get(r.item.id)?.[0] ?? undefined);
          return {
            itemId: r.item.id,
            title: r.item.title ?? "",
            spaceId: r.space.id,
            spaceName: r.space.name,
            snippet,
            itemType: r.item.itemType,
            entityType: r.item.entityType,
          };
        });
        const relatedItems = hybrid.rows.slice(0, 12).map((r) => ({
          itemId: r.item.id,
          spaceId: r.space.id,
          title: (r.item.title ?? "").slice(0, 255),
          score: typeof r.score === "number" ? Math.max(0, Math.min(1, r.score)) : undefined,
          snippet:
            hybrid.itemIdToFtsSnippet.get(r.item.id)?.slice(0, 1200) ??
            hybrid.itemIdToChunks.get(r.item.id)?.[0]?.slice(0, 1200),
        }));
        const bySpace = new Map<
          string,
          { spaceTitle: string; score: number; topTitles: string[] }
        >();
        for (const row of hybrid.rows) {
          const entry = bySpace.get(row.space.id) ?? {
            spaceTitle: row.space.name,
            score: 0,
            topTitles: [],
          };
          entry.score += typeof row.score === "number" ? row.score : 0;
          if (entry.topTitles.length < 3) {
            const title = (row.item.title ?? "").trim();
            if (title) entry.topTitles.push(title.slice(0, 255));
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
              spaceId,
              spaceTitle: entry.spaceTitle.slice(0, 255),
              path: path || undefined,
              score,
              reason:
                entry.topTitles.length > 0
                  ? `Related cards: ${entry.topTitles.join(", ")}`
                  : undefined,
              topTitles: entry.topTitles,
            };
          });
        return { clientId: n.clientId, rows, relatedItems, spaceCandidates };
      }),
    );
    for (const r of results) {
      candidatesByNoteClientId[r.clientId] = r.rows;
      relatedItemsByNoteClientId[r.clientId] = r.relatedItems;
      spaceCandidatesByNoteClientId[r.clientId] = r.spaceCandidates;
      for (const candidate of r.spaceCandidates) {
        const existing = globalSpaceSuggestions.get(candidate.spaceId);
        if (!existing || (candidate.score ?? 0) > existing.score) {
          globalSpaceSuggestions.set(candidate.spaceId, {
            spaceId: candidate.spaceId,
            spaceTitle: candidate.spaceTitle,
            path: candidate.path,
            score: candidate.score ?? 0,
            reason: candidate.reason,
          });
        }
      }
    }
    findings = {
      ...findings,
      candidates: Object.values(candidatesByNoteClientId).reduce(
        (sum, rows) => sum + rows.length,
        0,
      ),
      candidateSpaces: globalSpaceSuggestions.size,
    };
    await emitEvent({
      kind: "vault_search",
      phase: "vault_retrieval",
      durationMs: Math.max(0, Date.now() - retrievalStartedAt),
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
    clientId: n.clientId,
    title: n.title,
    summary: n.summary,
    bodyPreview: n.bodyText.slice(0, 3500),
  }));
  await reportProgress("merge", "Comparing import notes with candidate cards", {
    phaseFraction: 0.08,
    meta: { subphase: "candidate_match" },
  });

  const {
    mergeProposals: rawMerges,
    contradictions: rawContra,
    targetSpaces: rawTargetSpaces,
  } =
    await runLoreImportMergeLlmBatched(
      args.apiKey,
      args.model,
      mergeInput,
      candidatesByNoteClientId,
      spaceCandidatesByNoteClientId,
      async (step, total) => {
        await reportProgress("merge", "Running merge analysis batches", {
          step,
          total,
          meta: {
            subphase: `batch ${step} of ${total}`,
          },
        });
      },
      async (event) => {
        await emitLlmCall(event, "merge");
      },
    );
  const targetSpaceByNoteClientId = new Map(
    rawTargetSpaces.map((row) => [row.noteClientId, row]),
  );

  const mergeProposals = rawMerges.map((m) => {
    const row = candidatesByNoteClientId[m.noteClientId]?.find(
      (c) => c.itemId === m.targetItemId,
    );
    return {
      id: randomUUID(),
      noteClientId: m.noteClientId,
      targetItemId: m.targetItemId,
      targetTitle: row?.title ?? "Item",
      targetSpaceName: row?.spaceName,
      targetItemType: row?.itemType ?? null,
      targetEntityType: row?.entityType ?? null,
      strategy: m.strategy,
      proposedText: m.proposedText,
      rationale: m.rationale,
    };
  });

  const contradictions = rawContra.map((c) => ({
    id: randomUUID(),
    noteClientId: c.noteClientId,
    summary: c.summary,
    details: c.details,
  }));
  findings = {
    ...findings,
    mergeProposals: mergeProposals.length,
    contradictions: contradictions.length,
    targetSpaceRoutes: rawTargetSpaces.filter((row) => row.targetSpaceId).length,
  };

  const kindByClientId = new Map(
    notesInternal.map((n) => [n.clientId, n.canonicalEntityKind]),
  );
  const impliedBindingLinks = notesInternal
    .map((n) => {
      if (n.body?.kind !== "character") return null;
      const target = n.body.affiliationFactionClientId?.trim();
      if (!target) return null;
      if (!notesInternal.some((candidate) => candidate.clientId === target)) return null;
      return {
        fromClientId: n.clientId,
        toClientId: target,
        linkType: "alliance",
        linkIntent: "binding_hint" as const,
      };
    })
    .filter((l): l is { fromClientId: string; toClientId: string; linkType: string; linkIntent: "binding_hint" } => Boolean(l));
  const coercionWarnings: string[] = [];
  const shapedOutlineLinks = [...outline.links, ...impliedBindingLinks].map((l) => {
    const fromKind = kindByClientId.get(l.fromClientId);
    const toKind = kindByClientId.get(l.toClientId);
    const coerced = coerceImportLinkType(fromKind, toKind, l.linkType);
    if (coerced.coerced && coerced.reason) {
      coercionWarnings.push(
        `Link ${l.fromClientId} → ${l.toClientId}: ${coerced.reason}`,
      );
    }
    return {
      fromClientId: l.fromClientId,
      toClientId: l.toClientId,
      linkType: coerced.linkType,
      linkIntent: l.linkIntent,
    };
  });

  const {
    links: coLocatedLinks,
    crossSpaceMentions,
    warnings: linkWarnings,
  } = filterPlanLinksToSameCanvasSpace(
    notesInternal.map((n) => ({
      clientId: n.clientId,
      folderClientId: n.folderClientId,
    })),
    shapedOutlineLinks,
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

  // Group cross-space drafts by source note so we can attach mention arrays and add
  // readable `[[Title]]` markers to body text while preserving structured metadata.
  const mentionsBySource = new Map<
    string,
    { toClientId: string; targetTitle: string; linkType: string; linkIntent?: "association" | "binding_hint" }[]
  >();
  for (const m of crossSpaceMentions) {
    const targetTitle = titleByClientId.get(m.toClientId);
    if (!targetTitle) continue;
    const list = mentionsBySource.get(m.fromClientId) ?? [];
    list.push({
      toClientId: m.toClientId,
      targetTitle,
      linkType: m.linkType ?? "history",
      linkIntent: m.linkIntent,
    });
    mentionsBySource.set(m.fromClientId, list);
  }
  for (const n of notesInternal) {
    const mentions = mentionsBySource.get(n.clientId);
    if (!mentions || mentions.length === 0) continue;
    const markers = mentions
      .map((m) => `[[${m.targetTitle}]]`)
      .join(", ");
    const appended = `\n\n**Related (in other folders):** ${markers}`;
    n.bodyText = (n.bodyText + appended).slice(0, 120_000);
    (n as { crossFolderMentions?: typeof mentions }).crossFolderMentions = mentions;
  }

  const clarifyPayload = {
    folders: outline.folders.map((f) => ({
      clientId: f.clientId,
      title: f.title,
      parentClientId: f.parentClientId,
    })),
    notes: notesInternal.map((n) => ({
      clientId: n.clientId,
      title: n.title,
      summary: n.summary.slice(0, 600),
      folderClientId: n.folderClientId,
      canonicalEntityKind: n.canonicalEntityKind,
      ingestionSignals: n.ingestionSignals,
      loreHistorical: n.loreHistorical,
    })),
    links: coLocatedLinks,
    mergeProposals: mergeProposals.map((m) => ({
      id: m.id,
      noteClientId: m.noteClientId,
      targetItemId: m.targetItemId,
      targetTitle: m.targetTitle,
      strategy: m.strategy,
      rationale: m.rationale,
    })),
    contradictions: contradictions.map((c) => ({
      id: c.id,
      noteClientId: c.noteClientId,
      summary: c.summary,
      details: c.details,
    })),
    chunks: chunks.map((c) => ({
      id: c.id,
      heading: c.heading,
      excerpt: args.fullText.slice(
        c.charStart,
        Math.min(c.charEnd, c.charStart + 2400),
      ),
    })),
  };

  await reportProgress("clarify", "Generating contradiction and clarification questions", {
    phaseFraction: 0.12,
  });
  const clarifyRaw = await runLoreImportClarifyLlm(
    args.apiKey,
    args.model,
    clarifyPayload,
    async (event) => {
      await emitLlmCall(event, "clarify");
    },
  );
  await reportProgress("clarify", "Consolidating review questions", { phaseFraction: 0.95 });
  let clarifications = normalizeClarificationsFromLlm(clarifyRaw);
  clarifications = ensureClarificationsForContradictions(
    contradictions,
    mergeProposals,
    clarifications,
  );
  clarifications = capClarificationList(clarifications);
  clarifications = withoutLinkSemanticsClarifications(clarifications);
  findings = {
    ...findings,
    clarifications: clarifications.length,
  };

  const planRaw: LoreImportPlan = {
    importBatchId: args.importBatchId,
    fileName: args.fileName,
    sourceCharCount: args.fullText.length,
    chunks: chunks.map((c) => ({
      id: c.id,
      heading: c.heading,
      charStart: c.charStart,
      charEnd: c.charEnd,
      body: c.body.slice(0, 32_000),
    })),
    folders: outline.folders.map((f) => ({
      clientId: f.clientId,
      title: f.title,
      parentClientId: f.parentClientId,
    })),
    notes: notesInternal.map((n) => {
      const mentions = (n as {
        crossFolderMentions?: {
          toClientId: string;
          targetTitle: string;
          linkType: string;
          linkIntent?: "association" | "binding_hint";
        }[];
      }).crossFolderMentions;
      const targetSpace = targetSpaceByNoteClientId.get(n.clientId);
      const relatedItems = relatedItemsByNoteClientId[n.clientId] ?? [];
      return {
        clientId: n.clientId,
        title: n.title,
        canonicalEntityKind: n.canonicalEntityKind,
        summary: n.summary,
        bodyText: n.bodyText,
        folderClientId: n.folderClientId,
        targetItemType: null,
        ingestionSignals: n.ingestionSignals,
        campaignEpoch: n.campaignEpoch,
        loreHistorical: n.loreHistorical,
        sourceChunkIds: n.sourceChunkIds,
        sourcePassages: n.sourcePassages,
        ...(n.body ? { body: n.body } : {}),
        ...(typeof targetSpace?.targetSpaceId === "string"
          ? { targetSpaceId: targetSpace.targetSpaceId }
          : {}),
        ...(typeof targetSpace?.confidence === "number"
          ? { targetSpaceConfidence: targetSpace.confidence }
          : {}),
        ...(targetSpace?.reason ? { targetSpaceReason: targetSpace.reason } : {}),
        ...(relatedItems.length > 0 ? { relatedItems } : {}),
        ...(mentions && mentions.length > 0
          ? { crossFolderMentions: mentions }
          : {}),
      };
    }),
    links: coLocatedLinks.map((l) => ({
      fromClientId: l.fromClientId,
      toClientId: l.toClientId,
      linkType: l.linkType,
      ...(l.linkIntent ? { linkIntent: l.linkIntent } : {}),
    })),
    mergeProposals,
    contradictions,
    clarifications,
    spaceSuggestions:
      globalSpaceSuggestions.size > 0
        ? [...globalSpaceSuggestions.values()]
            .sort((a, b) => b.score - a.score)
            .slice(0, 25)
            .map((row) => ({
              spaceId: row.spaceId,
              spaceTitle: row.spaceTitle,
              path: row.path,
              score: row.score,
              reason: row.reason,
            }))
        : undefined,
    importPlanWarnings:
      linkWarnings.length > 0 ||
      coercionWarnings.length > 0 ||
      locationTopFieldTrimWarnings.length > 0
        ? [...locationTopFieldTrimWarnings, ...coercionWarnings, ...linkWarnings]
        : undefined,
    userContext: args.userContext,
  };

  const parsed = loreImportPlanSchema.safeParse(planRaw);
  if (!parsed.success) {
    await flushCurrentPhase();
    throw new Error(`Plan validation failed: ${parsed.error.message}`);
  }
  await reportProgress("finalize", "Finalizing validated import plan", { phaseFraction: 1 });
  await flushCurrentPhase();
  return parsed.data;
}
