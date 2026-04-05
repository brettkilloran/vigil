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

function asItemType(v: string): ItemType {
  return ITEM_TYPES.includes(v as ItemType) ? (v as ItemType) : "note";
}

export function rowToCanvasItem(row: ItemRow): CanvasItem {
  return {
    id: row.id,
    spaceId: row.spaceId,
    itemType: asItemType(row.itemType),
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    zIndex: row.zIndex,
    title: row.title,
    contentText: row.contentText,
    contentJson: row.contentJson ?? undefined,
    imageUrl: row.imageUrl,
    imageMeta: row.imageMeta ?? undefined,
    color: row.color,
    entityType: row.entityType,
    entityMeta: row.entityMeta ?? undefined,
    stackId: row.stackId,
    stackOrder: row.stackOrder ?? undefined,
  };
}
