import { randomUUID } from "crypto";
import { and, eq, max, sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { z } from "zod";

import { importReviewItems, itemLinks, items, spaces } from "@/src/db/schema";
import { buildContentJsonForFolderEntity } from "@/src/components/foundation/architectural-db-bridge";
import type { CanvasFolderEntity } from "@/src/components/foundation/architectural-types";
import { DS_COLOR } from "@/src/lib/design-system-tokens";
import {
  buildImportedEntityMeta,
  type CrossFolderRef,
} from "@/src/lib/entity-meta-schema";
import { validateLinkTargetsInSourceSpace } from "@/src/lib/item-links-validation";
import { connectionKindMetaForLinkType } from "@/src/lib/connection-kind-colors";
import {
  buildLoreNoteContentJsonMerged,
  buildLoreSourceContentJson,
  buildLoreStructuredBodyContentJson,
} from "@/src/lib/lore-import-commit";
import { placeImportCards } from "@/src/lib/lore-import-placement";
import {
  applyClarificationPatches,
  resolveOtherClarificationAnswers,
  validateClarificationAnswersForApply,
} from "@/src/lib/lore-import-clarifications";
import {
  filterPlanLinksToSameCanvasSpace,
  normalizeImportItemLinkType,
} from "@/src/lib/lore-import-item-link";
import { coerceImportLinkType } from "@/src/lib/lore-import-link-shape";
import {
  buildBindingPatchForImport,
  mergeHgArchBindingPatches,
  type BindingPatch,
} from "@/src/lib/lore-import-apply-bindings";
import type { CanonicalEntityKind } from "@/src/lib/lore-import-canonical-kinds";
import {
  buildDefaultEntityMeta,
  type ClarificationAnswer,
  clarificationAnswerSchema,
  loreImportPlanSchema,
  type LoreImportPlan,
} from "@/src/lib/lore-import-plan-types";
import type { VigilDb } from "@/src/lib/spaces";
import { assertSpaceExists } from "@/src/lib/spaces";
import {
  persistedEntityTypeForLoreSource,
  persistedEntityTypeFromCanonical,
} from "@/src/lib/lore-object-registry";
import { buildSearchBlob } from "@/src/lib/search-blob";
import { scheduleVaultReindexAfterResponse } from "@/src/lib/schedule-vault-index-after";
import { parseFactionRoster, type FactionRosterEntry } from "@/src/lib/faction-roster-schema";

type ItemRow = InferSelectModel<typeof items>;

const NODE_W = 280;
const FOLDER_W = 420;
const FOLDER_H = 280;
export const SOURCE_SECTION_CARD_MAX_CHARS = 10_000;

type SourceCardDraft = {
  title: string;
  text: string;
};

export function splitIntoSourceParts(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= SOURCE_SECTION_CARD_MAX_CHARS) return [trimmed];
  const out: string[] = [];
  let cursor = 0;
  while (cursor < trimmed.length) {
    out.push(trimmed.slice(cursor, cursor + SOURCE_SECTION_CARD_MAX_CHARS));
    cursor += SOURCE_SECTION_CARD_MAX_CHARS;
  }
  return out;
}

export function buildSourceCardDraftsFromPlan(
  plan: LoreImportPlan,
  fallbackSourceText: string,
  baseTitle: string,
): SourceCardDraft[] {
  if (!plan.chunks || plan.chunks.length === 0) {
    const parts = splitIntoSourceParts(fallbackSourceText);
    return parts.map((part, idx) => ({
      title:
        parts.length > 1
          ? `${baseTitle} • Part ${idx + 1}`
          : baseTitle,
      text: part,
    }));
  }
  const referencedChunkIds = new Set<string>();
  for (const note of plan.notes) {
    for (const p of note.sourcePassages ?? []) referencedChunkIds.add(p.chunkId);
    for (const id of note.sourceChunkIds ?? []) referencedChunkIds.add(id);
  }
  const byHeading = new Map<string, string[]>();
  for (const ch of plan.chunks) {
    if (referencedChunkIds.size > 0 && !referencedChunkIds.has(ch.id)) continue;
    const heading = (ch.heading || "Document").trim() || "Document";
    const list = byHeading.get(heading) ?? [];
    if (ch.body?.trim()) list.push(ch.body.trim());
    byHeading.set(heading, list);
  }
  const drafts: SourceCardDraft[] = [];
  for (const [heading, bodies] of byHeading.entries()) {
    const merged = bodies.join("\n\n").trim();
    if (!merged) continue;
    const parts = splitIntoSourceParts(merged);
    for (let i = 0; i < parts.length; i += 1) {
      drafts.push({
        title:
          parts.length > 1
            ? `${baseTitle} — ${heading} • Part ${i + 1}`
            : `${baseTitle} — ${heading}`,
        text: parts[i]!,
      });
    }
  }
  return drafts.length > 0 ? drafts : [{ title: baseTitle, text: fallbackSourceText.trim() }];
}

export const loreImportApplyBodySchema = z.object({
  spaceId: z.string().uuid(),
  importBatchId: z.string().uuid(),
  plan: loreImportPlanSchema,
  layout: z
    .object({
      originX: z.number().finite(),
      originY: z.number().finite(),
    })
    .optional(),
  includeSourceCard: z.boolean().optional(),
  sourceDocument: z
    .object({
      title: z.string().max(255).optional(),
      text: z.string().max(500_000).optional(),
    })
    .optional(),
  acceptedMergeProposalIds: z.array(z.string().uuid()).default([]),
  /** If set, only these note clientIds are created (excluding those fully handled by merges). */
  createNoteClientIds: z.array(z.string().min(1).max(64)).optional(),
  /** Answers for plan.clarifications; required items must all be present before apply. */
  clarificationAnswers: z.array(clarificationAnswerSchema).optional().default([]),
});

export type LoreImportApplyBody = z.infer<typeof loreImportApplyBodySchema>;

function fallbackOneNoteTitle(plan: LoreImportPlan, body: LoreImportApplyBody): string {
  const explicit =
    plan.oneNoteSource?.title?.trim() ||
    body.sourceDocument?.title?.trim() ||
    plan.fileName?.replace(/\.[^.]+$/, "").trim();
  return explicit || "Imported document";
}

function fallbackOneNoteText(plan: LoreImportPlan, body: LoreImportApplyBody): string {
  const explicit = plan.oneNoteSource?.text?.trim();
  if (explicit) return explicit;
  const sourceDoc = body.sourceDocument?.text?.trim();
  if (sourceDoc) return sourceDoc;
  if (plan.chunks?.length) {
    const merged = plan.chunks
      .map((c) => c.body?.trim())
      .filter((v): v is string => Boolean(v))
      .join("\n\n")
      .trim();
    if (merged) return merged;
  }
  const fromNotes = plan.notes
    .map((n) => n.bodyText.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
  return fromNotes;
}

function sortFoldersTopologically(
  folders: LoreImportPlan["folders"],
): LoreImportPlan["folders"] {
  const ids = new Set(folders.map((f) => f.clientId));
  const byId = new Map(folders.map((f) => [f.clientId, f]));
  const children = new Map<string, string[]>();
  for (const f of folders) {
    const p = f.parentClientId;
    if (p && ids.has(p)) {
      const list = children.get(p) ?? [];
      list.push(f.clientId);
      children.set(p, list);
    }
  }
  const roots = folders.filter((f) => !f.parentClientId || !ids.has(f.parentClientId));
  const out: LoreImportPlan["folders"] = [];
  const seen = new Set<string>();
  const queue = roots.map((f) => f.clientId);
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    const f = byId.get(id);
    if (!f) continue;
    seen.add(id);
    out.push(f);
    for (const c of children.get(id) ?? []) queue.push(c);
  }
  for (const f of folders) {
    if (!seen.has(f.clientId)) out.push(f);
  }
  return out;
}

async function nextZIndex(
  tx: Pick<VigilDb, "select">,
  spaceId: string,
): Promise<number> {
  const [mz] = await tx
    .select({ z: max(items.zIndex) })
    .from(items)
    .where(eq(items.spaceId, spaceId));
  const n = mz?.z != null && Number.isFinite(Number(mz.z)) ? Number(mz.z) + 1 : 101;
  return n;
}

export async function applyLoreImportPlan(
  db: VigilDb,
  raw: LoreImportApplyBody,
): Promise<
  | {
      status: "applied";
      createdItemIds: string[];
      folderItemIds: string[];
      linksCreated: number;
      mergesApplied: number;
      linkWarnings: string[];
    }
  | {
      status: "needs_follow_up";
      resolvedClarificationAnswers: ClarificationAnswer[];
      followUp: {
        clarificationId: string;
        title: string;
        question: string;
        options: { id: string; label: string; recommended?: boolean }[];
        confidence: number;
        otherText: string;
      };
    }
> {
  const body = loreImportApplyBodySchema.parse(raw);
  const space = await assertSpaceExists(db, body.spaceId);
  if (!space) {
    throw new Error("Space not found");
  }

  let plan = body.plan;
  const granularity = plan.userContext?.granularity ?? "many";
  const orgMode = plan.userContext?.orgMode ?? "folders";
  if (plan.importBatchId !== body.importBatchId) {
    throw new Error("importBatchId mismatch between body and plan");
  }

  const clarificationAnswers = body.clarificationAnswers ?? [];
  const resolvedOther = resolveOtherClarificationAnswers(plan, clarificationAnswers);
  if (resolvedOther.status === "needs_follow_up") {
    return {
      status: "needs_follow_up",
      resolvedClarificationAnswers: resolvedOther.answers,
      followUp: resolvedOther.followUp,
    };
  }
  const normalizedAnswers = resolvedOther.answers;
  const v = validateClarificationAnswersForApply(plan, normalizedAnswers);
  if (!v.ok) throw new Error(v.error);
  try {
    plan = applyClarificationPatches(plan, normalizedAnswers);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Clarification patch failed";
    throw new Error(msg);
  }
  // Re-coerce link types against current canonicalEntityKind values (clarification
  // patches may have shifted a note's kind and made an earlier link type invalid).
  const kindByClientIdForApply = new Map(
    plan.notes.map((n) => [n.clientId, n.canonicalEntityKind]),
  );
  const applyCoercionWarnings: string[] = [];
  const shapedLinks = plan.links.map((l) => {
    const fromKind = kindByClientIdForApply.get(l.fromClientId);
    const toKind = kindByClientIdForApply.get(l.toClientId);
    const coerced = coerceImportLinkType(fromKind, toKind, l.linkType);
    if (coerced.coerced && coerced.reason) {
      applyCoercionWarnings.push(
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

  const linkRefilter = filterPlanLinksToSameCanvasSpace(
    plan.notes.map((n) => ({
      clientId: n.clientId,
      folderClientId: orgMode === "nearby" ? null : n.folderClientId,
    })),
    shapedLinks,
  );
  // Re-derive cross-folder mentions after clarification patches (folder reassignments may
  // have created new cross-folder pairs). Merge with any already set on the plan.
  const titleByClientId = new Map(plan.notes.map((n) => [n.clientId, n.title]));
  const newMentionsBySource = new Map<string, {
    toClientId: string;
    targetTitle: string;
    linkType: string;
    linkIntent?: "association" | "binding_hint";
  }[]>();
  for (const m of linkRefilter.crossSpaceMentions) {
    const targetTitle = titleByClientId.get(m.toClientId);
    if (!targetTitle) continue;
    const list = newMentionsBySource.get(m.fromClientId) ?? [];
    list.push({
      toClientId: m.toClientId,
      targetTitle,
      linkType: m.linkType ?? "history",
      linkIntent: m.linkIntent,
    });
    newMentionsBySource.set(m.fromClientId, list);
  }
  plan = {
    ...plan,
    notes: plan.notes.map((n) => {
      const fresh = newMentionsBySource.get(n.clientId) ?? [];
      const existing = n.crossFolderMentions ?? [];
      const seen = new Set(existing.map((m) => `${m.toClientId}|${m.linkType}`));
      const merged = [
        ...existing,
        ...fresh.filter((m) => !seen.has(`${m.toClientId}|${m.linkType}`)),
      ];
      if (merged.length === 0) return n;
      return { ...n, crossFolderMentions: merged };
    }),
    links: linkRefilter.links,
    importPlanWarnings: [
      ...(plan.importPlanWarnings ?? []),
      ...applyCoercionWarnings,
      ...linkRefilter.warnings,
    ],
  };

  const mergeIdSet = new Set(plan.mergeProposals.map((m) => m.id));
  const acceptedMergeIds = new Set(
    body.acceptedMergeProposalIds.filter((id) => mergeIdSet.has(id)),
  );
  const mergeProposalsAccepted = plan.mergeProposals.filter((m) =>
    acceptedMergeIds.has(m.id),
  );
  const mergedNoteClientIds = new Set(
    mergeProposalsAccepted.map((m) => m.noteClientId),
  );

  let notesToCreate = plan.notes.filter((n) => !mergedNoteClientIds.has(n.clientId));
  if (body.createNoteClientIds?.length) {
    const allow = new Set(body.createNoteClientIds);
    notesToCreate = notesToCreate.filter((n) => allow.has(n.clientId));
  }

  const ox = body.layout?.originX ?? 0;
  const oy = body.layout?.originY ?? 0;

  const folderClientToChildSpace = new Map<string, string>();
  const clientIdToItemId = new Map<string, string>();

  const createdItemIds: string[] = [];
  const folderItemIds: string[] = [];
  const linkWarnings: string[] = [];
  let linksCreated = 0;
  let mergesApplied = 0;

  const rowsToSchedule: ItemRow[] = [];

  await db.transaction(async (tx) => {
    const dbx = tx as unknown as VigilDb;
    if (granularity === "one_note") {
      const z = await nextZIndex(dbx, body.spaceId);
      const title = fallbackOneNoteTitle(plan, body).slice(0, 255);
      const contentText = fallbackOneNoteText(plan, body).slice(0, 120_000);
      const contentJson = buildLoreStructuredBodyContentJson(undefined, contentText);
      const entityMeta = buildImportedEntityMeta({
        base: {
          schemaVersion: 1,
          import: true,
          canonicalEntityKind: "lore",
          aiReview: "pending",
        },
        importBatchId: plan.importBatchId,
        canonicalEntityKind: "lore",
      });
      const searchBlob = buildSearchBlob({
        title,
        contentText,
        contentJson,
        entityType: persistedEntityTypeFromCanonical("lore"),
        entityMeta,
        imageUrl: null,
        imageMeta: null,
        loreSummary: null,
        loreAliases: null,
      });
      const [row] = await dbx
        .insert(items)
        .values({
          spaceId: body.spaceId,
          itemType: "note",
          x: ox,
          y: oy,
          width: NODE_W,
          height: 280,
          zIndex: z,
          title,
          contentText,
          searchBlob,
          contentJson,
          color: DS_COLOR.itemDefaultNote,
          entityType: persistedEntityTypeFromCanonical("lore"),
          entityMeta,
        })
        .returning();
      if (row) {
        createdItemIds.push(row.id);
        rowsToSchedule.push(row);
      }
      return;
    }

    const sortedFolders = orgMode === "folders" ? sortFoldersTopologically(plan.folders) : [];
    for (const folder of sortedFolders) {
      const parentSpaceId = folder.parentClientId
        ? (folderClientToChildSpace.get(folder.parentClientId) ?? body.spaceId)
        : body.spaceId;

      const folderZ = await nextZIndex(dbx, parentSpaceId);

      const [childSpace] = await dbx
        .insert(spaces)
        .values({
          name: folder.title.slice(0, 255),
          parentSpaceId,
        })
        .returning();
      if (!childSpace) continue;
      folderClientToChildSpace.set(folder.clientId, childSpace.id);

      const fx = ox + sortedFolders.indexOf(folder) * 40;
      const fy = oy + sortedFolders.indexOf(folder) * 36;

      const tempFolder: CanvasFolderEntity = {
        id: "",
        title: folder.title.slice(0, 255),
        kind: "folder",
        theme: "folder",
        childSpaceId: childSpace.id,
        rotation: 0,
        width: FOLDER_W,
        tapeRotation: 0,
        stackId: null,
        stackOrder: null,
        slots: {},
      };

      const folderEntityMeta = buildImportedEntityMeta({
        import: true,
        importBatchId: plan.importBatchId,
      });
      const folderSearch = buildSearchBlob({
        title: folder.title.slice(0, 255),
        contentText: "",
        contentJson: null,
        entityType: null,
        entityMeta: folderEntityMeta,
        imageUrl: null,
        imageMeta: null,
        loreSummary: null,
        loreAliases: null,
      });

      const [folderRow] = await dbx
        .insert(items)
        .values({
          spaceId: parentSpaceId,
          itemType: "folder",
          x: fx,
          y: fy,
          width: FOLDER_W,
          height: FOLDER_H,
          zIndex: folderZ,
          title: folder.title.slice(0, 255),
          contentText: "",
          searchBlob: folderSearch,
          contentJson: buildContentJsonForFolderEntity(tempFolder),
          color: null,
          entityType: null,
          entityMeta: folderEntityMeta,
        })
        .returning();

      if (folderRow) {
        folderItemIds.push(folderRow.id);
        createdItemIds.push(folderRow.id);
        rowsToSchedule.push(folderRow);
      }
    }

    for (const m of mergeProposalsAccepted) {
      const [existing] = await dbx
        .select()
        .from(items)
        .where(eq(items.id, m.targetItemId))
        .limit(1);
      if (!existing) {
        linkWarnings.push(`Merge skipped — target ${m.targetItemId} not found`);
        continue;
      }
      const approved = existing.contentText.trim().slice(0, 120_000);
      const proposed = m.proposedText.trim().slice(0, 120_000);
      const mergedText = `${approved}\n\n${proposed}`.slice(0, 500_000);
      const contentJson = buildLoreNoteContentJsonMerged(approved, proposed);
      const prevMeta =
        existing.entityMeta && typeof existing.entityMeta === "object"
          ? (existing.entityMeta as Record<string, unknown>)
          : {};
      const mergedEntityMeta = buildImportedEntityMeta({
        existing: prevMeta,
        aiReview: "pending",
      });
      const searchBlob = buildSearchBlob({
        title: existing.title,
        contentText: mergedText.slice(0, 120_000),
        contentJson,
        entityType: existing.entityType,
        entityMeta: mergedEntityMeta,
        imageUrl: existing.imageUrl,
        imageMeta: existing.imageMeta,
        loreSummary: existing.loreSummary,
        loreAliases: existing.loreAliases ?? undefined,
      });

      const [updated] = await dbx
        .update(items)
        .set({
          contentText: mergedText.slice(0, 120_000),
          contentJson,
          searchBlob,
          entityMeta: mergedEntityMeta,
          updatedAt: new Date(),
        })
        .where(eq(items.id, m.targetItemId))
        .returning();

      if (updated) {
        mergesApplied += 1;
        clientIdToItemId.set(m.noteClientId, m.targetItemId);
        rowsToSchedule.push(updated);
      }
    }

    const sourceText =
      body.sourceDocument?.text?.trim() ?? "";
    const hasSource =
      body.includeSourceCard === true && sourceText.length > 0;
    const sourceTitleBase =
      body.sourceDocument?.title?.trim() ||
      plan.fileName ||
      "Import source";
    const sourceCardDrafts = hasSource
      ? buildSourceCardDraftsFromPlan(plan, sourceText, sourceTitleBase)
      : [];

    // Resolve the target space id for each note up-front so we can compute
    // per-space proximity placement in one pass.
    const notesBySpace = new Map<string, typeof notesToCreate>();
    for (const note of notesToCreate) {
      const spaceId = orgMode === "folders" && note.folderClientId
        ? (folderClientToChildSpace.get(note.folderClientId) ?? body.spaceId)
        : body.spaceId;
      const list = notesBySpace.get(spaceId) ?? [];
      list.push(note);
      notesBySpace.set(spaceId, list);
    }

    const placementByNoteClient = new Map<string, {
      x: number;
      y: number;
      width: number;
      height: number;
    }>();
    let rootSourceRect:
      | { x: number; y: number; width: number; height: number }
      | undefined;
    for (const [spaceId, notes] of notesBySpace.entries()) {
      const entities = notes.map((n) => ({
        clientId: n.clientId,
        affinities: plan.links
          .filter((l) =>
            (l.fromClientId === n.clientId || l.toClientId === n.clientId) &&
            notes.some(
              (m) =>
                m.clientId ===
                (l.fromClientId === n.clientId ? l.toClientId : l.fromClientId),
            ),
          )
          .map((l) =>
            l.fromClientId === n.clientId ? l.toClientId : l.fromClientId,
          ),
      }));
      const layout = placeImportCards({
        originX: spaceId === body.spaceId ? ox : 0,
        originY: spaceId === body.spaceId ? oy : 0,
        source:
          spaceId === body.spaceId && hasSource
            ? { width: 420, height: 360 }
            : undefined,
        entities,
      });
      if (spaceId === body.spaceId && layout.source) {
        rootSourceRect = layout.source;
      }
      for (const e of entities) {
        const rect = layout.entities[e.clientId];
        if (rect) placementByNoteClient.set(e.clientId, rect);
      }
    }

    let zRoot = await nextZIndex(dbx, body.spaceId);
    if (hasSource && rootSourceRect) {
      const layoutSource = rootSourceRect;
      for (let i = 0; i < sourceCardDrafts.length; i += 1) {
        const draft = sourceCardDrafts[i]!;
        const sourceContentJson = buildLoreSourceContentJson(draft.text.slice(0, 120_000));
        const sourceEntityMeta = buildImportedEntityMeta({
          base: {
            sourceSectionIndex: i,
            sourceSectionTotal: sourceCardDrafts.length,
          },
          import: true,
          importBatchId: plan.importBatchId,
          aiReview: "pending",
        });
        const searchBlob = buildSearchBlob({
          title: draft.title.slice(0, 255),
          contentText: draft.text.slice(0, 120_000),
          contentJson: sourceContentJson,
          entityType: persistedEntityTypeForLoreSource(),
          entityMeta: sourceEntityMeta,
          imageUrl: null,
          imageMeta: null,
          loreSummary: null,
          loreAliases: null,
        });
        const [row] = await dbx
          .insert(items)
          .values({
            spaceId: body.spaceId,
            itemType: "note",
            x: layoutSource.x + i * 28,
            y: layoutSource.y + i * 26,
            width: layoutSource.width,
            height: layoutSource.height,
            zIndex: zRoot++,
            title: draft.title.slice(0, 255),
            contentText: draft.text.slice(0, 120_000),
            searchBlob,
            contentJson: sourceContentJson,
            color: DS_COLOR.itemDefaultNote,
            entityType: persistedEntityTypeForLoreSource(),
            entityMeta: sourceEntityMeta,
          })
          .returning();
        if (row) {
          createdItemIds.push(row.id);
          rowsToSchedule.push(row);
        }
      }
    }

    for (const note of notesToCreate) {
      const targetSpaceId = orgMode === "folders" && note.folderClientId
        ? (folderClientToChildSpace.get(note.folderClientId) ?? body.spaceId)
        : body.spaceId;

      const pos =
        placementByNoteClient.get(note.clientId) ?? {
          x: 0,
          y: 0,
          width: NODE_W,
          height: 260,
        };
      const z = await nextZIndex(dbx, targetSpaceId);

      const bodyText = note.bodyText.slice(0, 120_000);
      const contentJson = buildLoreStructuredBodyContentJson(note.body, bodyText);
      const entityMeta = buildImportedEntityMeta({
        base: buildDefaultEntityMeta(note),
        importBatchId: plan.importBatchId,
        canonicalEntityKind: note.canonicalEntityKind as CanonicalEntityKind,
      });

      const persistedEntityType = persistedEntityTypeFromCanonical(
        note.canonicalEntityKind as CanonicalEntityKind,
      );
      const searchBlob = buildSearchBlob({
        title: note.title.slice(0, 255),
        contentText: bodyText,
        contentJson,
        entityType: persistedEntityType,
        entityMeta,
        imageUrl: null,
        imageMeta: null,
        loreSummary: null,
        loreAliases: null,
      });

      const [row] = await dbx
        .insert(items)
        .values({
          spaceId: targetSpaceId,
          itemType: "note",
          x: pos.x,
          y: pos.y,
          width: pos.width,
          height: pos.height,
          zIndex: z,
          title: note.title.slice(0, 255),
          contentText: bodyText,
          searchBlob,
          contentJson,
          color: DS_COLOR.itemDefaultNote,
          entityType: persistedEntityType,
          entityMeta,
        })
        .returning();

      if (row) {
        createdItemIds.push(row.id);
        clientIdToItemId.set(note.clientId, row.id);
        rowsToSchedule.push(row);
      }
    }

    // Faction roster auto-fill from character affiliations (co-created + merged-vault factions).
    const normalizeNameKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const factionByNormalizedTitle = new Map<string, string>();
    for (const m of mergeProposalsAccepted) {
      if (m.targetEntityType !== "faction") continue;
      const key = normalizeNameKey(m.targetTitle ?? "");
      if (!key) continue;
      factionByNormalizedTitle.set(key, m.targetItemId);
    }
    const factionMembers = new Map<string, Set<string>>();
    for (const note of plan.notes) {
      if (note.body?.kind !== "character") continue;
      const characterItemId = clientIdToItemId.get(note.clientId);
      if (!characterItemId) continue;
      let factionItemId: string | undefined;
      const factionClientId = note.body.affiliationFactionClientId?.trim();
      if (factionClientId) {
        factionItemId = clientIdToItemId.get(factionClientId);
      }
      if (!factionItemId && note.body.affiliation?.trim()) {
        const key = normalizeNameKey(note.body.affiliation);
        if (key) factionItemId = factionByNormalizedTitle.get(key);
      }
      if (!factionItemId) continue;
      const members = factionMembers.get(factionItemId) ?? new Set<string>();
      members.add(characterItemId);
      factionMembers.set(factionItemId, members);
    }
    for (const [factionItemId, members] of factionMembers.entries()) {
      if (members.size === 0) continue;
      let factionRow = rowsToSchedule.find((r) => r.id === factionItemId);
      if (!factionRow) {
        const [existingFaction] = await dbx
          .select()
          .from(items)
          .where(eq(items.id, factionItemId))
          .limit(1);
        if (!existingFaction) continue;
        factionRow = existingFaction;
      }
      const prevContentJson =
        factionRow.contentJson && typeof factionRow.contentJson === "object"
          ? (factionRow.contentJson as Record<string, unknown>)
          : {};
      const prevHgArch =
        prevContentJson.hgArch && typeof prevContentJson.hgArch === "object"
          ? (prevContentJson.hgArch as Record<string, unknown>)
          : {};
      const prevRoster = parseFactionRoster(prevHgArch.factionRoster) ?? [];
      const seenCharacterIds = new Set(
        prevRoster
          .filter((entry): entry is Extract<FactionRosterEntry, { kind: "character" }> => entry.kind === "character")
          .map((entry) => entry.characterItemId),
      );
      const additions: FactionRosterEntry[] = [];
      for (const characterItemId of members.values()) {
        if (seenCharacterIds.has(characterItemId)) continue;
        additions.push({
          id: randomUUID(),
          kind: "character",
          characterItemId,
        });
      }
      if (additions.length === 0) continue;
      const nextContentJson = {
        ...prevContentJson,
        hgArch: {
          ...prevHgArch,
          factionRoster: [...prevRoster, ...additions],
        },
      };
      const prevMeta =
        factionRow.entityMeta && typeof factionRow.entityMeta === "object"
          ? (factionRow.entityMeta as Record<string, unknown>)
          : {};
      const nextEntityMeta = buildImportedEntityMeta({
        existing: prevMeta,
        aiReview: "pending",
      });
      const [updated] = await dbx
        .update(items)
        .set({
          contentJson: nextContentJson,
          entityMeta: nextEntityMeta,
          updatedAt: new Date(),
        })
        .where(eq(items.id, factionItemId))
        .returning();
      if (updated) {
        const idx = rowsToSchedule.findIndex((r) => r.id === factionItemId);
        if (idx >= 0) rowsToSchedule[idx] = updated;
        else rowsToSchedule.push(updated);
      }
    }

    // Cross-folder mentions: once targets have real item ids, append `vigil:item:<uuid>`
    // pointers to each source note's bodyText/contentJson and record cross-folder refs.
    for (const note of notesToCreate) {
      const mentions = note.crossFolderMentions;
      if (!mentions || mentions.length === 0) continue;
      const sourceItemId = clientIdToItemId.get(note.clientId);
      if (!sourceItemId) continue;
      const sourceRow = rowsToSchedule.find((r) => r.id === sourceItemId);
      if (!sourceRow) continue;

      const resolvedRefs: CrossFolderRef[] = [];
      const vigilAppendParts: string[] = [];
      for (const m of mentions) {
        const targetItemId = clientIdToItemId.get(m.toClientId);
        if (!targetItemId) continue;
        resolvedRefs.push({
          targetItemId,
          targetTitle: m.targetTitle,
          linkType: m.linkType,
          linkIntent: m.linkIntent,
        });
        vigilAppendParts.push(
          `[[${m.targetTitle}]] (vigil:item:${targetItemId})`,
        );
      }
      if (resolvedRefs.length === 0) continue;

      const appendBlock = `\n\n${vigilAppendParts.join(" · ")}`;
      const nextContentText = (sourceRow.contentText + appendBlock).slice(0, 120_000);
      const nextContentJson =
        sourceRow.entityType === persistedEntityTypeForLoreSource()
          ? buildLoreSourceContentJson(nextContentText)
          : (sourceRow.contentJson as Record<string, unknown> | null);
      const prevMeta =
        sourceRow.entityMeta && typeof sourceRow.entityMeta === "object"
          ? (sourceRow.entityMeta as Record<string, unknown>)
          : {};
      const nextEntityMeta = buildImportedEntityMeta({
        existing: prevMeta,
        crossFolderRefs: resolvedRefs,
      });
      const nextSearchBlob = buildSearchBlob({
        title: sourceRow.title,
        contentText: nextContentText,
        contentJson: nextContentJson,
        entityType: sourceRow.entityType,
        entityMeta: nextEntityMeta,
        imageUrl: sourceRow.imageUrl ?? null,
        imageMeta: sourceRow.imageMeta ?? null,
        loreSummary: sourceRow.loreSummary ?? null,
        loreAliases: sourceRow.loreAliases ?? null,
      });

      const [updated] = await dbx
        .update(items)
        .set({
          contentText: nextContentText,
          contentJson: nextContentJson,
          searchBlob: nextSearchBlob,
          entityMeta: nextEntityMeta,
          updatedAt: new Date(),
        })
        .where(eq(items.id, sourceItemId))
        .returning();
      if (updated) {
        const idx = rowsToSchedule.findIndex((r) => r.id === sourceItemId);
        if (idx >= 0) rowsToSchedule[idx] = updated;
      }
    }

    for (const link of plan.links) {
      const fromId = clientIdToItemId.get(link.fromClientId);
      const toId = clientIdToItemId.get(link.toClientId);
      if (!fromId || !toId) {
        linkWarnings.push(
          `Skipped link ${link.fromClientId} → ${link.toClientId} (unresolved client id)`,
        );
        continue;
      }
      if (fromId === toId) continue;

      const validated = await validateLinkTargetsInSourceSpace(dbx, fromId, [toId]);
      if (!validated.ok) {
        linkWarnings.push(validated.error);
        continue;
      }

      const linkType = normalizeImportItemLinkType(link.linkType);
      const canonicalLinkMeta = connectionKindMetaForLinkType(linkType);
      const [lr] = await dbx
        .insert(itemLinks)
        .values({
          sourceItemId: fromId,
          targetItemId: toId,
          linkType,
          label: null,
          /** Null: canvas hydration supplies default pin anchors (`mergeHydratedDbConnections`). */
          sourcePin: null,
          targetPin: null,
          color: null,
          meta: {
            import: true,
            importBatchId: plan.importBatchId,
            ...(canonicalLinkMeta
              ? {
                  linkSemanticFamily: canonicalLinkMeta.semanticFamily,
                  linkSemanticKeywords: canonicalLinkMeta.autopopulationKeywords,
                }
              : {}),
            ...(link.linkIntent ? { linkIntent: link.linkIntent } : {}),
          },
        })
        .onConflictDoNothing({
          target: [
            itemLinks.sourceItemId,
            itemLinks.targetItemId,
            itemLinks.sourcePin,
            itemLinks.targetPin,
          ],
        })
        .returning();
      if (lr) linksCreated += 1;
    }

    // Binding-hint promotion: for each link marked `linkIntent: "binding_hint"`, compute
    // a structured hgArch patch for the source card and merge it in. The item_links row
    // is still created above — the binding is additive.
    const bindingPatchesBySource = new Map<string, BindingPatch[]>();
    for (const link of plan.links) {
      if (link.linkIntent !== "binding_hint") continue;
      const fromId = clientIdToItemId.get(link.fromClientId);
      const toId = clientIdToItemId.get(link.toClientId);
      if (!fromId || !toId) continue;
      const patch = buildBindingPatchForImport({
        sourceKind: kindByClientIdForApply.get(link.fromClientId),
        targetKind: kindByClientIdForApply.get(link.toClientId),
        targetItemId: toId,
        targetTitle: titleByClientId.get(link.toClientId),
      });
      if (!patch) continue;
      const list = bindingPatchesBySource.get(fromId) ?? [];
      list.push(patch);
      bindingPatchesBySource.set(fromId, list);
    }

    for (const [sourceItemId, patches] of bindingPatchesBySource.entries()) {
      const sourceRow = rowsToSchedule.find((r) => r.id === sourceItemId);
      if (!sourceRow) continue;
      const prevContentJson =
        sourceRow.contentJson && typeof sourceRow.contentJson === "object"
          ? (sourceRow.contentJson as Record<string, unknown>)
          : {};
      const prevHgArch =
        prevContentJson.hgArch && typeof prevContentJson.hgArch === "object"
          ? (prevContentJson.hgArch as Record<string, unknown>)
          : {};
      const { hgArch: nextHgArch, touchedSlots } = mergeHgArchBindingPatches(
        prevHgArch,
        patches,
      );
      if (touchedSlots.length === 0) continue;
      const nextContentJson = { ...prevContentJson, hgArch: nextHgArch };
      const prevMeta =
        sourceRow.entityMeta && typeof sourceRow.entityMeta === "object"
          ? (sourceRow.entityMeta as Record<string, unknown>)
          : {};
      const prevBindings =
        prevMeta.pendingBindingSlots &&
        Array.isArray(prevMeta.pendingBindingSlots)
          ? (prevMeta.pendingBindingSlots as string[])
          : [];
      const pendingBindingSlots = Array.from(
        new Set([...prevBindings, ...touchedSlots]),
      );
      const nextEntityMeta = buildImportedEntityMeta({
        existing: { ...prevMeta, pendingBindingSlots },
        aiReview: "pending",
      });
      const [updated] = await dbx
        .update(items)
        .set({
          contentJson: nextContentJson,
          entityMeta: nextEntityMeta,
          updatedAt: new Date(),
        })
        .where(eq(items.id, sourceItemId))
        .returning();
      if (updated) {
        const idx = rowsToSchedule.findIndex((r) => r.id === sourceItemId);
        if (idx >= 0) rowsToSchedule[idx] = updated;
      }
    }

    for (const a of normalizedAnswers) {
      await tx
        .update(importReviewItems)
        .set({ status: "resolved", updatedAt: new Date() })
        .where(
          and(
            eq(importReviewItems.importBatchId, plan.importBatchId),
            eq(importReviewItems.spaceId, body.spaceId),
            sql`(${importReviewItems.payload}->>'clarificationId') = ${a.clarificationId}`,
          ),
        );
    }
  });

  for (const row of rowsToSchedule) {
    if (row.contentText.trim().length > 0 || row.title.trim().length > 0) {
      scheduleVaultReindexAfterResponse(row.id);
    }
  }

  return {
    status: "applied",
    createdItemIds,
    folderItemIds,
    linksCreated,
    mergesApplied,
    linkWarnings,
  };
}
