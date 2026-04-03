import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";

import type { tryGetDb } from "@/src/db/index";
import { itemLinks, items, spaces } from "@/src/db/schema";
import type { CameraState } from "@/src/stores/canvas-types";
import { defaultCamera } from "@/src/stores/canvas-types";

export type VigilDb = NonNullable<ReturnType<typeof tryGetDb>>;

export function parseCameraFromRow(raw: unknown): CameraState {
  if (!raw || typeof raw !== "object") return defaultCamera();
  const o = raw as Record<string, unknown>;
  if (
    typeof o.x === "number" &&
    typeof o.y === "number" &&
    typeof o.zoom === "number" &&
    Number.isFinite(o.x) &&
    Number.isFinite(o.y) &&
    Number.isFinite(o.zoom) &&
    o.zoom > 0
  ) {
    return { x: o.x, y: o.y, zoom: o.zoom };
  }
  return defaultCamera();
}

export async function listAllSpaces(db: VigilDb) {
  return db
    .select()
    .from(spaces)
    .orderBy(desc(spaces.updatedAt));
}

export async function resolveActiveSpace(
  db: VigilDb,
  requestedSpaceId?: string,
) {
  let allSpaces = await listAllSpaces(db);
  if (allSpaces.length === 0) {
    const [created] = await db
      .insert(spaces)
      .values({ name: "Main space" })
      .returning();
    allSpaces = [created!];
  }
  const active =
    requestedSpaceId && allSpaces.some((s) => s.id === requestedSpaceId)
      ? allSpaces.find((s) => s.id === requestedSpaceId)!
      : allSpaces[0];
  return { activeSpace: active, allSpaces };
}

export async function assertSpaceExists(db: VigilDb, spaceId: string) {
  const [row] = await db
    .select()
    .from(spaces)
    .where(eq(spaces.id, spaceId))
    .limit(1);
  return row;
}

export async function listItemsForSpace(db: VigilDb, spaceId: string) {
  return db
    .select()
    .from(items)
    .where(eq(items.spaceId, spaceId))
    .orderBy(asc(items.zIndex), asc(items.createdAt));
}

export async function searchItemsFTS(db: VigilDb, spaceId: string, query: string) {
  const q = query.trim();
  if (!q) return [];
  return db
    .select()
    .from(items)
    .where(
      and(
        eq(items.spaceId, spaceId),
        sql`to_tsvector('english', coalesce(${items.title}, '') || ' ' || coalesce(${items.contentText}, '')) @@ plainto_tsquery('english', ${q})`,
      ),
    )
    .orderBy(desc(items.updatedAt))
    .limit(50);
}

export async function listLinksForItem(db: VigilDb, itemId: string) {
  return db
    .select()
    .from(itemLinks)
    .where(
      or(
        eq(itemLinks.sourceItemId, itemId),
        eq(itemLinks.targetItemId, itemId),
      ),
    );
}

export type LinkEndpoint = {
  id: string;
  title: string;
  itemType: string;
};

export type ResolvedLinkOut = {
  linkId: string;
  linkType: string;
  label: string | null;
  to: LinkEndpoint;
};

export type ResolvedLinkIn = {
  linkId: string;
  linkType: string;
  label: string | null;
  from: LinkEndpoint;
};

export async function getItemLinksResolved(
  db: VigilDb,
  itemId: string,
): Promise<{ outgoing: ResolvedLinkOut[]; incoming: ResolvedLinkIn[] }> {
  const links = await listLinksForItem(db, itemId);
  const peerIds = new Set<string>();
  for (const l of links) {
    if (l.sourceItemId === itemId) peerIds.add(l.targetItemId);
    else peerIds.add(l.sourceItemId);
  }
  if (peerIds.size === 0) {
    return { outgoing: [], incoming: [] };
  }
  const peerRows = await db
    .select({
      id: items.id,
      title: items.title,
      itemType: items.itemType,
    })
    .from(items)
    .where(inArray(items.id, [...peerIds]));
  const peerMap = new Map(
    peerRows.map((p) => [
      p.id,
      { id: p.id, title: p.title, itemType: p.itemType },
    ]),
  );

  const outgoing: ResolvedLinkOut[] = [];
  const incoming: ResolvedLinkIn[] = [];
  for (const l of links) {
    if (l.sourceItemId === itemId) {
      const to = peerMap.get(l.targetItemId);
      if (to) {
        outgoing.push({
          linkId: l.id,
          linkType: l.linkType,
          label: l.label,
          to,
        });
      }
    } else {
      const from = peerMap.get(l.sourceItemId);
      if (from) {
        incoming.push({
          linkId: l.id,
          linkType: l.linkType,
          label: l.label,
          from,
        });
      }
    }
  }
  return { outgoing, incoming };
}
