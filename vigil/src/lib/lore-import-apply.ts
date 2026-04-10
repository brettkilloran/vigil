import { and, eq, max, sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { z } from "zod";

import { importReviewItems, itemLinks, items, spaces } from "@/src/db/schema";
import { buildContentJsonForFolderEntity } from "@/src/components/foundation/architectural-db-bridge";
import type { CanvasFolderEntity } from "@/src/components/foundation/architectural-types";
import { DS_COLOR } from "@/src/lib/design-system-tokens";
import { scheduleItemEmbeddingRefresh } from "@/src/lib/item-vault-index";
import { validateLinkTargetsInSourceSpace } from "@/src/lib/item-links-validation";
import {
  buildLoreNoteContentJson,
  planLoreImportCardLayout,
} from "@/src/lib/lore-import-commit";
import {
  applyClarificationPatches,
  validateClarificationAnswersForApply,
} from "@/src/lib/lore-import-clarifications";
import {
  filterPlanLinksToSameCanvasSpace,
  normalizeImportItemLinkType,
} from "@/src/lib/lore-import-item-link";
import {
  buildDefaultEntityMeta,
  clarificationAnswerSchema,
  loreImportPlanSchema,
  type LoreImportPlan,
} from "@/src/lib/lore-import-plan-types";
import type { VigilDb } from "@/src/lib/spaces";
import { assertSpaceExists } from "@/src/lib/spaces";
import { buildSearchBlob } from "@/src/lib/search-blob";
import { scheduleVaultReindexAfterResponse } from "@/src/lib/schedule-vault-index-after";

type ItemRow = InferSelectModel<typeof items>;

const NODE_W = 280;
const GAP = 28;
const ROW_H = 280;
const COLS = 2;
const FOLDER_W = 420;
const FOLDER_H = 280;

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

/** Per-space note layout cursor */
function makeGridPlacer(ox: number, oy: number) {
  let i = 0;
  return () => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    i += 1;
    return {
      x: ox + col * (NODE_W + GAP),
      y: oy + row * ROW_H,
      width: NODE_W,
      height: 260,
    };
  };
}

export async function applyLoreImportPlan(
  db: VigilDb,
  raw: LoreImportApplyBody,
): Promise<{
  createdItemIds: string[];
  folderItemIds: string[];
  linksCreated: number;
  mergesApplied: number;
  linkWarnings: string[];
}> {
  const body = loreImportApplyBodySchema.parse(raw);
  const space = await assertSpaceExists(db, body.spaceId);
  if (!space) {
    throw new Error("Space not found");
  }

  let plan = body.plan;
  if (plan.importBatchId !== body.importBatchId) {
    throw new Error("importBatchId mismatch between body and plan");
  }

  const clarificationAnswers = body.clarificationAnswers ?? [];
  const v = validateClarificationAnswersForApply(plan, clarificationAnswers);
  if (!v.ok) throw new Error(v.error);
  try {
    plan = applyClarificationPatches(plan, clarificationAnswers);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Clarification patch failed";
    throw new Error(msg);
  }
  const linkRefilter = filterPlanLinksToSameCanvasSpace(
    plan.notes.map((n) => ({
      clientId: n.clientId,
      folderClientId: n.folderClientId,
    })),
    plan.links.map((l) => ({
      fromClientId: l.fromClientId,
      toClientId: l.toClientId,
      linkType: l.linkType,
    })),
  );
  plan = {
    ...plan,
    links: linkRefilter.links,
    importPlanWarnings: [
      ...(plan.importPlanWarnings ?? []),
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
  const spacePlacers = new Map<string, ReturnType<typeof makeGridPlacer>>();

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
    const sortedFolders = sortFoldersTopologically(plan.folders);
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

      const folderSearch = buildSearchBlob({
        title: folder.title.slice(0, 255),
        contentText: "",
        contentJson: null,
        entityType: null,
        entityMeta: { import: true, importBatchId: plan.importBatchId },
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
          entityMeta: { import: true, importBatchId: plan.importBatchId },
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
      const mergedText = `${existing.contentText.trim()}\n\n${m.proposedText.trim()}`.slice(
        0,
        500_000,
      );
      const contentJson = buildLoreNoteContentJson(mergedText.slice(0, 120_000));
      const searchBlob = buildSearchBlob({
        title: existing.title,
        contentText: mergedText.slice(0, 120_000),
        contentJson,
        entityType: existing.entityType,
        entityMeta: existing.entityMeta,
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
    const layout = planLoreImportCardLayout(
      ox,
      oy,
      hasSource,
      notesToCreate.length,
    );

    let zRoot = await nextZIndex(dbx, body.spaceId);
    if (hasSource && layout.source) {
      const title =
        body.sourceDocument?.title?.trim() ||
        plan.fileName ||
        "Import source";
      const contentJson = buildLoreNoteContentJson(sourceText.slice(0, 120_000));
      const searchBlob = buildSearchBlob({
        title: title.slice(0, 255),
        contentText: sourceText.slice(0, 120_000),
        contentJson,
        entityType: "lore_source",
        entityMeta: { import: true, importBatchId: plan.importBatchId },
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
          x: layout.source.x,
          y: layout.source.y,
          width: layout.source.width,
          height: layout.source.height,
          zIndex: zRoot++,
          title: title.slice(0, 255),
          contentText: sourceText.slice(0, 120_000),
          searchBlob,
          contentJson,
          color: DS_COLOR.itemDefaultNote,
          entityType: "lore_source",
          entityMeta: { import: true, importBatchId: plan.importBatchId },
        })
        .returning();
      if (row) {
        createdItemIds.push(row.id);
        rowsToSchedule.push(row);
      }
    }

    for (const note of notesToCreate) {
      const targetSpaceId = note.folderClientId
        ? (folderClientToChildSpace.get(note.folderClientId) ?? body.spaceId)
        : body.spaceId;

      if (!spacePlacers.has(targetSpaceId)) {
        spacePlacers.set(targetSpaceId, makeGridPlacer(0, 0));
      }
      const placer = spacePlacers.get(targetSpaceId)!;
      const pos = placer();
      const z = await nextZIndex(dbx, targetSpaceId);

      const bodyText = note.bodyText.slice(0, 120_000);
      const contentJson = buildLoreNoteContentJson(bodyText);
      const entityMeta = {
        ...buildDefaultEntityMeta(note),
        importBatchId: plan.importBatchId,
      };

      const searchBlob = buildSearchBlob({
        title: note.title.slice(0, 255),
        contentText: bodyText,
        contentJson,
        entityType: note.canonicalEntityKind,
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
          entityType: note.canonicalEntityKind,
          entityMeta,
        })
        .returning();

      if (row) {
        createdItemIds.push(row.id);
        clientIdToItemId.set(note.clientId, row.id);
        rowsToSchedule.push(row);
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
          meta: { import: true, importBatchId: plan.importBatchId },
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

    for (const a of clarificationAnswers) {
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
    scheduleItemEmbeddingRefresh(db, row);
    if (row.contentText.trim().length > 0 || row.title.trim().length > 0) {
      scheduleVaultReindexAfterResponse(row.id);
    }
  }

  return {
    createdItemIds,
    folderItemIds,
    linksCreated,
    mergesApplied,
    linkWarnings,
  };
}
