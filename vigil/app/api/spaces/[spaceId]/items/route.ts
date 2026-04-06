import { eq } from "drizzle-orm";
import { z } from "zod";

import { tryGetDb } from "@/src/db/index";
import { items } from "@/src/db/schema";
import { getHeartgardenApiBootContext, heartgardenApiForbiddenJsonResponse } from "@/src/lib/heartgarden-api-boot-context";
import { requireHeartgardenSpaceApiAccess } from "@/src/lib/heartgarden-space-route-access";
import { DS_COLOR } from "@/src/lib/design-system-tokens";
import {
  playersMayCreateItemType,
  stripGmOnlyEntityMetaPatch,
} from "@/src/lib/player-item-policy";
import { scheduleItemEmbeddingRefresh } from "@/src/lib/item-embedding";
import { rowToCanvasItem } from "@/src/lib/item-mapper";
import { buildSearchBlob } from "@/src/lib/search-blob";
import { scheduleVaultReindexAfterResponse } from "@/src/lib/schedule-vault-index-after";
import { listItemsForSpace } from "@/src/lib/spaces";

const createBody = z.object({
  /** When set, insert this row id (used for undo-after-delete restore). Must not already exist. */
  id: z.string().uuid().optional(),
  itemType: z.enum(["note", "sticky", "image", "checklist", "webclip", "folder"]),
  x: z.number().default(0),
  y: z.number().default(0),
  width: z.number().positive().max(4000).default(280),
  height: z.number().positive().max(4000).default(200),
  title: z.string().max(255).optional(),
  contentText: z.string().optional(),
  contentJson: z.record(z.string(), z.any()).optional(),
  color: z.string().max(64).optional(),
  entityType: z.string().max(64).optional(),
  entityMeta: z.record(z.string(), z.any()).optional(),
  imageUrl: z.string().max(8192).optional(),
  imageMeta: z.record(z.string(), z.any()).optional(),
  zIndex: z.number().int().optional(),
  stackId: z.string().uuid().nullable().optional(),
  stackOrder: z.number().int().nullable().optional(),
});

export async function GET(
  _req: Request,
  context: { params: Promise<{ spaceId: string }> },
) {
  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { ok: false, error: "Database not configured" },
      { status: 503 },
    );
  }
  const bootCtx = await getHeartgardenApiBootContext();
  const { spaceId } = await context.params;
  const access = await requireHeartgardenSpaceApiAccess(db, bootCtx, spaceId);
  if (!access.ok) return access.response;
  const rows = await listItemsForSpace(db, spaceId);
  return Response.json({ ok: true, items: rows.map(rowToCanvasItem) });
}

export async function POST(
  req: Request,
  context: { params: Promise<{ spaceId: string }> },
) {
  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { ok: false, error: "Database not configured" },
      { status: 503 },
    );
  }
  const bootCtx = await getHeartgardenApiBootContext();
  const { spaceId } = await context.params;
  const access = await requireHeartgardenSpaceApiAccess(db, bootCtx, spaceId);
  if (!access.ok) return access.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createBody.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const t = parsed.data.itemType;
  if (bootCtx.role === "player") {
    if (!playersMayCreateItemType(t)) {
      return heartgardenApiForbiddenJsonResponse();
    }
    if (parsed.data.imageUrl !== undefined || parsed.data.imageMeta !== undefined) {
      return heartgardenApiForbiddenJsonResponse();
    }
    if (parsed.data.id !== undefined) {
      return heartgardenApiForbiddenJsonResponse();
    }
  }

  if (parsed.data.id) {
    const [existing] = await db.select().from(items).where(eq(items.id, parsed.data.id)).limit(1);
    if (existing) {
      return Response.json({ ok: false, error: "Item id already exists" }, { status: 409 });
    }
  }

  const entityMetaForRow =
    bootCtx.role === "player"
      ? stripGmOnlyEntityMetaPatch(parsed.data.entityMeta as Record<string, unknown> | undefined) ??
        null
      : (parsed.data.entityMeta ?? null);

  const defaultTitle =
    t === "note"
      ? "Note"
      : t === "sticky"
        ? "Sticky"
        : t === "folder"
          ? "Folder"
          : t === "checklist"
            ? "Checklist"
            : t === "webclip"
              ? "Web clip"
              : "Item";
  const title = parsed.data.title?.trim() || defaultTitle;
  const contentText = parsed.data.contentText ?? "";
  const color =
    parsed.data.color ??
    (t === "sticky" ? DS_COLOR.itemDefaultSticky : t === "note" ? DS_COLOR.itemDefaultNote : null);
  const searchBlob = buildSearchBlob({
    title,
    contentText,
    contentJson: parsed.data.contentJson ?? null,
    entityType: parsed.data.entityType ?? null,
    entityMeta: entityMetaForRow,
    imageUrl: parsed.data.imageUrl ?? null,
    imageMeta: parsed.data.imageMeta ?? null,
    loreSummary: null,
    loreAliases: null,
  });

  const [row] = await db
    .insert(items)
    .values({
      ...(parsed.data.id ? { id: parsed.data.id } : {}),
      spaceId,
      itemType: t,
      x: parsed.data.x,
      y: parsed.data.y,
      width: parsed.data.width,
      height: parsed.data.height,
      title,
      contentText,
      searchBlob,
      contentJson: parsed.data.contentJson ?? null,
      color,
      entityType: parsed.data.entityType ?? null,
      entityMeta: entityMetaForRow,
      imageUrl: parsed.data.imageUrl ?? null,
      imageMeta: parsed.data.imageMeta ?? null,
      ...(parsed.data.zIndex !== undefined ? { zIndex: parsed.data.zIndex } : {}),
      ...(parsed.data.stackId !== undefined ? { stackId: parsed.data.stackId } : {}),
      ...(parsed.data.stackOrder !== undefined ? { stackOrder: parsed.data.stackOrder } : {}),
    })
    .returning();

  if (row && bootCtx.role !== "player") {
    scheduleItemEmbeddingRefresh(db, row);
    if (contentText.trim().length > 0 || title.trim().length > 0) {
      scheduleVaultReindexAfterResponse(row.id);
    }
  }

  return Response.json({ ok: true, item: rowToCanvasItem(row!) });
}
