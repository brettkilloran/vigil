import { randomUUID } from "crypto";

import type { CanonicalEntityKind } from "@/src/lib/lore-import-canonical-kinds";
import { chunkSourceText } from "@/src/lib/lore-import-chunk";
import {
  attachBodiesToOutline,
  runLoreImportClarifyLlm,
  runLoreImportMergeLlm,
  runLoreImportOutlineLlm,
  type CandidateRow,
} from "@/src/lib/lore-import-plan-llm";
import {
  capClarificationList,
  ensureClarificationsForContradictions,
  normalizeClarificationsFromLlm,
} from "@/src/lib/lore-import-clarifications";
import { filterPlanLinksToSameCanvasSpace } from "@/src/lib/lore-import-item-link";
import type { IngestionSignals, LoreImportPlan } from "@/src/lib/lore-import-plan-types";
import { loreImportPlanSchema } from "@/src/lib/lore-import-plan-types";
import type { VigilDb } from "@/src/lib/spaces";
import { hybridRetrieveItems } from "@/src/lib/vault-retrieval";

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
}): Promise<LoreImportPlan> {
  const chunks = chunkSourceText(args.fullText);
  const outline = await runLoreImportOutlineLlm(
    args.apiKey,
    args.model,
    chunks,
    args.fullText,
  );
  attachBodiesToOutline(outline, chunks);

  const notesInternal: OutlineNoteInternal[] = outline.notes.map((n) => ({
    ...n,
    bodyText: String((n as { bodyText?: string }).bodyText ?? "").slice(0, 120_000),
  }));

  const candidatesByNoteClientId: Record<string, CandidateRow[]> = {};
  for (const n of notesInternal) {
    const q = `${n.title} ${n.summary}`.trim().slice(0, 800);
    const hybrid = await hybridRetrieveItems(args.db, q, {}, { maxItems: 8, includeVector: true });
    candidatesByNoteClientId[n.clientId] = hybrid.rows.map((r) => {
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
  }

  const mergeInput = notesInternal.map((n) => ({
    clientId: n.clientId,
    title: n.title,
    summary: n.summary,
    bodyPreview: n.bodyText.slice(0, 3500),
  }));

  const { mergeProposals: rawMerges, contradictions: rawContra } =
    await runLoreImportMergeLlm(
      args.apiKey,
      args.model,
      mergeInput,
      candidatesByNoteClientId,
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

  const { links: coLocatedLinks, warnings: linkWarnings } = filterPlanLinksToSameCanvasSpace(
    notesInternal.map((n) => ({
      clientId: n.clientId,
      folderClientId: n.folderClientId,
    })),
    outline.links.map((l) => ({
      fromClientId: l.fromClientId,
      toClientId: l.toClientId,
      linkType: l.linkType,
    })),
  );

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
    })),
    folders: outline.folders.map((f) => ({
      clientId: f.clientId,
      title: f.title,
      parentClientId: f.parentClientId,
    })),
    notes: notesInternal.map((n) => ({
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
    })),
    links: coLocatedLinks.map((l) => ({
      fromClientId: l.fromClientId,
      toClientId: l.toClientId,
      linkType: l.linkType,
    })),
    mergeProposals,
    contradictions,
    clarifications,
    importPlanWarnings: linkWarnings.length > 0 ? linkWarnings : undefined,
  };

  const parsed = loreImportPlanSchema.safeParse(planRaw);
  if (!parsed.success) {
    throw new Error(`Plan validation failed: ${parsed.error.message}`);
  }
  return parsed.data;
}
