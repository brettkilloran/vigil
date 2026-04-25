import type { InferSelectModel } from "drizzle-orm";

import type { items } from "@/src/db/schema";
import type { CanvasItem, ItemType } from "@/src/model/canvas-types";

type ItemRow = InferSelectModel<typeof items>;

const ITEM_TYPES: ItemType[] = [
  "note",
  "sticky",
  "image",
  "checklist",
  "webclip",
  "folder",
];

const unknownItemTypeWarnings = new Set<string>();

function asItemType(v: string): ItemType {
  if (ITEM_TYPES.includes(v as ItemType)) {
    return v as ItemType;
  }
  if (!unknownItemTypeWarnings.has(v)) {
    unknownItemTypeWarnings.add(v);
    console.warn("[item-mapper] unknown itemType fallback", v);
  }
  return "note";
}

export function rowToCanvasItem(row: ItemRow): CanvasItem {
  return {
    color: row.color,
    contentJson: row.contentJson ?? undefined,
    contentText: row.contentText,
    entityMeta: row.entityMeta ?? undefined,
    entityType: row.entityType,
    height: row.height,
    id: row.id,
    imageMeta: row.imageMeta ?? undefined,
    imageUrl: row.imageUrl,
    itemType: asItemType(row.itemType),
    spaceId: row.spaceId,
    stackId: row.stackId,
    stackOrder: row.stackOrder ?? undefined,
    title: row.title,
    updatedAt:
      row.updatedAt instanceof Date
        ? row.updatedAt.toISOString()
        : row.updatedAt
          ? String(row.updatedAt)
          : undefined,
    width: row.width,
    x: row.x,
    y: row.y,
    zIndex: row.zIndex,
  };
}
