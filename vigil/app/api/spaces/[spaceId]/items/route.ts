import { z } from "zod";

import { tryGetDb } from "@/src/db/index";
import { items } from "@/src/db/schema";
import {
  getHeartgardenApiBootContext,
  heartgardenApiForbiddenJsonResponse,
  heartgardenMaskNotFoundForVisitor,
  isHeartgardenVisitorBlocked,
  visitorMayAccessSpaceId,
} from "@/src/lib/heartgarden-api-boot-context";
import { scheduleItemEmbeddingRefresh } from "@/src/lib/item-embedding";
import { rowToCanvasItem } from "@/src/lib/item-mapper";
import { buildSearchBlob } from "@/src/lib/search-blob";
import { scheduleVaultReindexAfterResponse } from "@/src/lib/schedule-vault-index-after";
import { assertSpaceExists, listItemsForSpace } from "@/src/lib/spaces";
import { DS_COLOR } from "@/src/lib/design-system-tokens";

const createBody = z.object({
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
  if (isHeartgardenVisitorBlocked(bootCtx)) {
    return heartgardenApiForbiddenJsonResponse();
  }
  const { spaceId } = await context.params;
  const space = await assertSpaceExists(db, spaceId);
  if (!space) {
    return heartgardenMaskNotFoundForVisitor(
      bootCtx,
      Response.json({ ok: false, error: "Space not found" }, { status: 404 }),
    );
  }
  if (!visitorMayAccessSpaceId(bootCtx, spaceId)) {
    return heartgardenApiForbiddenJsonResponse();
  }
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
  if (isHeartgardenVisitorBlocked(bootCtx)) {
    return heartgardenApiForbiddenJsonResponse();
  }
  const { spaceId } = await context.params;
  const space = await assertSpaceExists(db, spaceId);
  if (!space) {
    return heartgardenMaskNotFoundForVisitor(
      bootCtx,
      Response.json({ ok: false, error: "Space not found" }, { status: 404 }),
    );
  }
  if (!visitorMayAccessSpaceId(bootCtx, spaceId)) {
    return heartgardenApiForbiddenJsonResponse();
  }

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
    entityMeta: parsed.data.entityMeta ?? null,
    imageUrl: parsed.data.imageUrl ?? null,
    imageMeta: parsed.data.imageMeta ?? null,
    loreSummary: null,
    loreAliases: null,
  });

  const [row] = await db
    .insert(items)
    .values({
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
      entityMeta: parsed.data.entityMeta ?? null,
      imageUrl: parsed.data.imageUrl ?? null,
      imageMeta: parsed.data.imageMeta ?? null,
      ...(parsed.data.zIndex !== undefined ? { zIndex: parsed.data.zIndex } : {}),
    })
    .returning();

  if (row && bootCtx.role !== "visitor") {
    scheduleItemEmbeddingRefresh(db, row);
    if (contentText.trim().length > 0 || title.trim().length > 0) {
      scheduleVaultReindexAfterResponse(row.id);
    }
  }

  return Response.json({ ok: true, item: rowToCanvasItem(row!) });
}
