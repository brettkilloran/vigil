import { and, eq, inArray, isNotNull, notInArray } from "drizzle-orm";

import { getDb } from "@/src/db/index";
import { items } from "@/src/db/schema";

type Db = ReturnType<typeof getDb>;

type VigilShapeRow = {
  id: string;
  typeName: string;
  type: string;
  x: number;
  y: number;
  props: {
    w: number;
    h: number;
    text: string;
    color: string;
  };
};

function isVigilShapeRecord(value: unknown): value is VigilShapeRow {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  if (o.typeName !== "shape") return false;
  if (o.type !== "vigil-note" && o.type !== "vigil-sticky") return false;
  if (typeof o.id !== "string") return false;
  if (typeof o.x !== "number" || typeof o.y !== "number") return false;
  const p = o.props;
  if (!p || typeof p !== "object") return false;
  const props = p as Record<string, unknown>;
  return (
    typeof props.w === "number" &&
    typeof props.h === "number" &&
    typeof props.text === "string" &&
    typeof props.color === "string"
  );
}

/**
 * Upsert `items` rows for vigil-note / vigil-sticky shapes and remove stale rows
 * whose `source_shape_id` no longer exists on the canvas.
 */
export async function syncVigilItemsFromStore(
  db: Db,
  spaceId: string,
  store: Record<string, unknown>,
) {
  const shapeRows = Object.values(store).filter(isVigilShapeRecord);
  const ids = shapeRows.map((s) => s.id);

  for (const s of shapeRows) {
    const itemType = s.type === "vigil-note" ? "note" : "sticky";
    const title =
      s.props.text.trim().slice(0, 255) ||
      (itemType === "note" ? "Note" : "Sticky");

    await db
      .insert(items)
      .values({
        spaceId,
        itemType,
        sourceShapeId: s.id,
        x: s.x,
        y: s.y,
        width: s.props.w,
        height: s.props.h,
        zIndex: 0,
        title,
        contentText: s.props.text,
        color: s.props.color,
      })
      .onConflictDoUpdate({
        target: [items.spaceId, items.sourceShapeId],
        set: {
          itemType,
          x: s.x,
          y: s.y,
          width: s.props.w,
          height: s.props.h,
          title,
          contentText: s.props.text,
          color: s.props.color,
          updatedAt: new Date(),
        },
      });
  }

  if (ids.length === 0) {
    await db.delete(items).where(
      and(
        eq(items.spaceId, spaceId),
        inArray(items.itemType, ["note", "sticky"]),
        isNotNull(items.sourceShapeId),
      ),
    );
    return;
  }

  await db.delete(items).where(
    and(
      eq(items.spaceId, spaceId),
      inArray(items.itemType, ["note", "sticky"]),
      isNotNull(items.sourceShapeId),
      notInArray(items.sourceShapeId, ids),
    ),
  );
}
