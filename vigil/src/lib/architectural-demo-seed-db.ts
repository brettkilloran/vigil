/**
 * Inserts the canonical Heartgarden architectural demo (folder + cards) into Neon
 * when the active space has no items. Runs on the server during bootstrap only.
 */
import { eq, sql } from "drizzle-orm";

import {
  architecturalItemType,
  buildContentJsonForContentEntity,
  buildContentJsonForFolderEntity,
  entityGeometryOnSpace,
  htmlToPlainText,
} from "@/src/components/foundation/architectural-db-bridge";
import {
  buildArchitecturalSeedGraph,
  pinSeedGraphToActiveSpace,
} from "@/src/components/foundation/architectural-seed";
import type {
  CanvasContentEntity,
  CanvasFolderEntity,
  CanvasGraph,
  CanvasSpace,
} from "@/src/components/foundation/architectural-types";
import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";
import { items, spaces } from "@/src/db/schema";
import { DS_COLOR } from "@/src/lib/design-system-tokens";
import { scheduleItemEmbeddingRefresh } from "@/src/lib/item-embedding";
import { buildSearchBlob } from "@/src/lib/search-blob";
import type { VigilDb } from "@/src/lib/spaces";

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function advisoryKeyPart2(spaceId: string): number {
  let h = 2166136261;
  for (let i = 0; i < spaceId.length; i += 1) {
    h ^= spaceId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 2147483646;
}

function spacesParentBeforeChildren(graph: CanvasGraph): CanvasSpace[] {
  const order: CanvasSpace[] = [];
  const done = new Set<string>();

  const visit = (id: string) => {
    if (done.has(id)) return;
    const s = graph.spaces[id];
    if (!s) return;
    if (s.parentSpaceId) visit(s.parentSpaceId);
    if (done.has(id)) return;
    done.add(id);
    order.push(s);
  };

  for (const id of Object.keys(graph.spaces)) visit(id);
  return order;
}

function depthFromRoot(graph: CanvasGraph, spaceId: string): number {
  let d = 0;
  let cur: string | undefined = spaceId;
  while (cur) {
    const s: CanvasSpace | undefined = graph.spaces[cur];
    if (!s?.parentSpaceId) break;
    d += 1;
    cur = s.parentSpaceId ?? undefined;
  }
  return d;
}

function primarySpaceForEntity(graph: CanvasGraph, entityId: string): string {
  const candidates = Object.values(graph.spaces).filter((s) => s.entityIds.includes(entityId));
  if (candidates.length === 0) return graph.rootSpaceId;
  candidates.sort((a, b) => depthFromRoot(graph, b.id) - depthFromRoot(graph, a.id));
  return candidates[0]!.id;
}

/** Prefer Neon root row when the seed lists the entity on the root canvas with root coordinates (e.g. node-3). */
function primarySpaceForDbInsert(
  graph: CanvasGraph,
  entityId: string,
  neonPinnedRootId: string,
): string {
  const root = graph.spaces[neonPinnedRootId];
  const entity = graph.entities[entityId];
  if (
    root?.entityIds.includes(entityId) &&
    entity &&
    "slots" in entity &&
    entity.slots &&
    neonPinnedRootId in entity.slots
  ) {
    return neonPinnedRootId;
  }
  return primarySpaceForEntity(graph, entityId);
}

function remapSlotKeys(
  slots: Record<string, { x: number; y: number }>,
  idMap: Map<string, string>,
): Record<string, { x: number; y: number }> {
  const next: Record<string, { x: number; y: number }> = {};
  for (const [k, v] of Object.entries(slots)) {
    next[idMap.get(k) ?? k] = v;
  }
  return next;
}

function itemColorForEntity(entity: CanvasContentEntity | CanvasFolderEntity): string | null {
  const t = architecturalItemType(entity);
  if (t === "sticky") return DS_COLOR.itemDefaultSticky;
  if (t === "note") return DS_COLOR.itemDefaultNote;
  return null;
}

/**
 * Idempotent: no-op if the active space already has at least one item.
 */
export async function ensureArchitecturalDemoSeed(
  db: VigilDb,
  activeSpaceId: string,
  existingSpaceIds: string[],
): Promise<void> {
  const tokens = {
    taskItem: styles.taskItem,
    done: styles.done,
    taskCheckbox: styles.taskCheckbox,
    taskText: styles.taskText,
    mediaFrame: styles.mediaFrame,
    mediaImage: styles.mediaImage,
    mediaImageActions: styles.mediaImageActions,
    mediaUploadBtn: styles.mediaUploadBtn,
  };

  const k2 = advisoryKeyPart2(activeSpaceId);

  await db.transaction(async (tx) => {
    await tx.execute(sql.raw(`SELECT pg_advisory_xact_lock(8742001, ${k2})`));

    const [existingItem] = await tx
      .select({ id: items.id })
      .from(items)
      .where(eq(items.spaceId, activeSpaceId))
      .limit(1);

    if (existingItem) return;

    const seed = buildArchitecturalSeedGraph(tokens, "default");
    const pinned = pinSeedGraphToActiveSpace(seed, activeSpaceId);

    const idMap = new Map<string, string>();
    for (const id of existingSpaceIds) idMap.set(id, id);

    for (const s of spacesParentBeforeChildren(pinned)) {
      if (idMap.has(s.id)) continue;
      if (isUuidLike(s.id)) {
        idMap.set(s.id, s.id);
        continue;
      }
      const parentRaw = s.parentSpaceId;
      const parentNeon = parentRaw ? (idMap.get(parentRaw) ?? parentRaw) : null;
      const [created] = await tx
        .insert(spaces)
        .values({
          name: s.name,
          parentSpaceId: parentNeon,
        })
        .returning();
      if (!created?.id) return;
      idMap.set(s.id, created.id);
    }

    const orderedEntities = Object.values(pinned.entities).sort((a, b) => {
      if (a.kind === "folder" && b.kind !== "folder") return -1;
      if (a.kind !== "folder" && b.kind === "folder") return 1;
      return 0;
    });

    let z = 100;
    for (const entity of orderedEntities) {
      const rawPrimary = primarySpaceForDbInsert(pinned, entity.id, activeSpaceId);
      const neonSpaceId = idMap.get(rawPrimary) ?? rawPrimary;

      if (entity.kind === "folder") {
        const f = entity as CanvasFolderEntity;
        const remappedChild = idMap.get(f.childSpaceId) ?? f.childSpaceId;
        const folder: CanvasFolderEntity = {
          ...f,
          childSpaceId: remappedChild,
          slots: remapSlotKeys(f.slots, idMap),
        };
        const { x, y, width, height } = entityGeometryOnSpace(folder, neonSpaceId);
        const title = folder.title || "Folder";
        const contentJson = buildContentJsonForFolderEntity(folder);
        const searchBlob = buildSearchBlob({
          title,
          contentText: "",
          contentJson,
          entityType: null,
          entityMeta: null,
          imageUrl: null,
          imageMeta: null,
          loreSummary: null,
          loreAliases: null,
        });
        const [row] = await tx
          .insert(items)
          .values({
            spaceId: neonSpaceId,
            itemType: "folder",
            x,
            y,
            width,
            height,
            title,
            contentText: "",
            searchBlob,
            contentJson,
            zIndex: z++,
          })
          .returning();
        if (row) scheduleItemEmbeddingRefresh(db, row);
        continue;
      }

      const c = entity as CanvasContentEntity;
      const content: CanvasContentEntity = {
        ...c,
        slots: remapSlotKeys(c.slots, idMap),
      };
      const { x, y, width, height } = entityGeometryOnSpace(content, neonSpaceId);
      const t = architecturalItemType(content);
      const title = content.title || "Untitled";
      const contentText = htmlToPlainText(content.bodyHtml);
      const contentJson = buildContentJsonForContentEntity(content);
      const searchBlob = buildSearchBlob({
        title,
        contentText,
        contentJson,
        entityType: null,
        entityMeta: null,
        imageUrl: null,
        imageMeta: null,
        loreSummary: null,
        loreAliases: null,
      });
      const [row] = await tx
        .insert(items)
        .values({
          spaceId: neonSpaceId,
          itemType: t,
          x,
          y,
          width,
          height,
          title,
          contentText,
          searchBlob,
          contentJson,
          color: itemColorForEntity(content),
          zIndex: z++,
        })
        .returning();
      if (row) scheduleItemEmbeddingRefresh(db, row);
    }
  });
}
