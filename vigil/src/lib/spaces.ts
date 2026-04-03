import { and, asc, desc, eq, or, sql } from "drizzle-orm";

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
