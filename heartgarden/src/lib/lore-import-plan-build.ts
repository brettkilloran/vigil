import { randomUUID } from "crypto";

import type { CanonicalEntityKind } from "@/src/lib/lore-import-canonical-kinds";
import { chunkSourceText } from "@/src/lib/lore-import-chunk";
import {
  attachBodiesToOutline,
  runLoreImportClarifyLlm,
  runLoreImportMergeLlmBatched,
  runLoreImportOutlineLlm,
  type CandidateRow,
} from "@/src/lib/lore-import-plan-llm";
import {
  buildChunkAssignmentClarifications,
  capClarificationList,
  ensureClarificationsForContradictions,
  normalizeClarificationsFromLlm,
} from "@/src/lib/lore-import-clarifications";
import { filterPlanLinksToSameCanvasSpace } from "@/src/lib/lore-import-item-link";
import { coerceImportLinkType } from "@/src/lib/lore-import-link-shape";
import type { LoreImportProgressReporter } from "@/src/lib/lore-import-progress";
import type { IngestionSignals, LoreImportPlan } from "@/src/lib/lore-import-plan-types";
import { loreImportPlanSchema } from "@/src/lib/lore-import-plan-types";
import type { HeartgardenApiBootContext } from "@/src/lib/heartgarden-api-boot-context";
import { finalizeHeartgardenSearchFiltersForDb } from "@/src/lib/heartgarden-search-tier-policy";
import type { SearchFilters, VigilDb } from "@/src/lib/spaces";
import { IMPORT_MERGE_HYBRID_OPTIONS } from "@/src/lib/vault-retrieval-profiles";
import { hybridRetrieveItems } from "@/src/lib/vault-retrieval";

const GM_LORE_IMPORT_SEARCH: HeartgardenApiBootContext = { role: "gm" };

const VAULT_SEARCH_CONCURRENCY = 5;

type OutlineNoteInternal = {
  clientId: string;
  title: string;
  canonicalEntityKind: CanonicalEntityKind;
  summary: string;
  folderClientId: string | null;
  sourceChunkIds: string[];
  ingestionSignals?: IngestionSignals;
  campaignEpoch?: number;
  loreHistorical?: boolean;
  bodyText: string;
};

export async function buildLoreImportPlan(args: {
  db: VigilDb;
  apiKey: string;
  model: string;
  fullText: string;
  importBatchId: string;
  fileName?: string;
  onProgress?: LoreImportProgressReporter;
}): Promise<LoreImportPlan> {
  const reportProgress = async (
    phase: string,
    message: string,
    detail?: { step?: number; total?: number; meta?: Record<string, unknown> },
  ) => {
    await args.onProgress?.({
      phase,
      message,
      step: detail?.step,
      total: detail?.total,
      meta: detail?.meta,
    });
  };
  await reportProgress("chunking", "Splitting source text into import chunks");
  const chunks = chunkSourceText(args.fullText);
  await reportProgress("outline", "Generating initial folder/note outline");
  const outline = await runLoreImportOutlineLlm(
    args.apiKey,
    args.model,
    chunks,
    args.fullText,
  );
  await reportProgress("outline", "Outline generated; attaching chunk-backed note bodies");
  const chunkDiagnostics = attachBodiesToOutline(outline, chunks);

  const notesInternal: OutlineNoteInternal[] = outline.notes.map((n) => ({
    ...n,
    bodyText: String((n as { bodyText?: string }).bodyText ?? "").slice(0, 120_000),
  }));

  const vaultSearchFilters: SearchFilters =
    (await finalizeHeartgardenSearchFiltersForDb(args.db, GM_LORE_IMPORT_SEARCH, {})) ?? {};

  const candidatesByNoteClientId: Record<string, CandidateRow[]> = {};
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
            spaceName: r.space.name,
            snippet,
            itemType: r.item.itemType,
            entityType: r.item.entityType,
          };
        });
        return { clientId: n.clientId, rows };
      }),
    );
    for (const r of results) {
      candidatesByNoteClientId[r.clientId] = r.rows;
    }
  }

  const mergeInput = notesInternal.map((n) => ({
    clientId: n.clientId,
    title: n.title,
    summary: n.summary,
    bodyPreview: n.bodyText.slice(0, 3500),
  }));
  await reportProgress("merge", "Comparing import notes with candidate cards");

  const { mergeProposals: rawMerges, contradictions: rawContra } =
    await runLoreImportMergeLlmBatched(
      args.apiKey,
      args.model,
      mergeInput,
      candidatesByNoteClientId,
      async (step, total) => {
        await reportProgress("merge", "Running merge analysis batches", { step, total });
      },
    );
  await reportProgress("clarify", "Generating contradiction and clarification questions");

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

  const kindByClientId = new Map(
    notesInternal.map((n) => [n.clientId, n.canonicalEntityKind]),
  );
  const coercionWarnings: string[] = [];
  const shapedOutlineLinks = outline.links.map((l) => {
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

  // Group cross-space drafts by the source note so we can attach mention arrays + inject
  // `[[Title]]` markers into `bodyText`. The apply path is responsible for resolving
  // the target client ids to real item UUIDs and appending `vigil:item:<uuid>` pointers.
  const titleByClientId = new Map(notesInternal.map((n) => [n.clientId, n.title]));
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

  const clarifyRaw = await runLoreImportClarifyLlm(
    args.apiKey,
    args.model,
    clarifyPayload,
  );
  let clarifications = normalizeClarificationsFromLlm(clarifyRaw);
  clarifications = ensureClarificationsForContradictions(
    contradictions,
    mergeProposals,
    clarifications,
  );
  const chunkClarifications = buildChunkAssignmentClarifications({
    noteClientIdsWithoutChunks: chunkDiagnostics.noteClientIdsWithoutChunks,
    unassignedChunkIds: chunkDiagnostics.unassignedChunkIds,
    duplicateAssignments: chunkDiagnostics.duplicateAssignments,
    notes: notesInternal.map((n) => ({ clientId: n.clientId, title: n.title })),
    chunks: chunks.map((c) => ({ id: c.id, heading: c.heading })),
  });
  clarifications = [...clarifications, ...chunkClarifications];
  clarifications = capClarificationList(clarifications);

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
    importPlanWarnings:
      linkWarnings.length > 0 || coercionWarnings.length > 0
        ? [...coercionWarnings, ...linkWarnings]
        : undefined,
  };

  const parsed = loreImportPlanSchema.safeParse(planRaw);
  if (!parsed.success) {
    throw new Error(`Plan validation failed: ${parsed.error.message}`);
  }
  await reportProgress("finalize", "Finalizing validated import plan");
  return parsed.data;
}
