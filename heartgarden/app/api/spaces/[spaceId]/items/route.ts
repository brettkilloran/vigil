import { eq } from "drizzle-orm";
import { z } from "zod";

import type { LoreCardKind } from "@/src/components/foundation/architectural-types";
import { tryGetDb } from "@/src/db/index";
import { items } from "@/src/db/schema";
import { getHeartgardenApiBootContext, heartgardenApiForbiddenJsonResponse } from "@/src/lib/heartgarden-api-boot-context";
import {
  defaultItemDimensions,
  nextZIndexForSpace,
  synthesizeContentJsonForCreateItem,
} from "@/src/lib/item-create-defaults";
import { normalizeCanonicalEntityKind } from "@/src/lib/lore-import-canonical-kinds";
import {
  isLoreCardPersistedEntityType,
  persistedEntityTypeFromCanonical,
} from "@/src/lib/lore-object-registry";
import {
  resolveLoreCardForCreate,
  synthesizeLoreCardContentJsonAndPlainText,
} from "@/src/lib/lore-item-create-synthesis";
import { requireHeartgardenSpaceApiAccess } from "@/src/lib/heartgarden-space-route-access";
import { DS_COLOR } from "@/src/lib/design-system-tokens";
import {
  playersMayCreateItemType,
  stripGmOnlyEntityMetaPatch,
} from "@/src/lib/player-item-policy";
import { publishHeartgardenSpaceInvalidation } from "@/src/lib/heartgarden-realtime-invalidation";
import { validateItemWriteJsonPayload } from "@/src/lib/heartgarden-item-json-schema";
import { jsonValidationError } from "@/src/lib/heartgarden-validation-error";
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
  /** Omit for type-based defaults (e.g. note 340×270, checklist 340×188, character 340×453). */
  width: z.number().positive().max(4000).optional(),
  height: z.number().positive().max(4000).optional(),
  title: z.string().max(255).optional(),
  contentText: z.string().optional(),
  contentJson: z.record(z.string(), z.any()).optional(),
  /** Applied when synthesizing `contentJson` for note/sticky (default/code/task). */
  theme: z.enum(["default", "code", "task"]).optional(),
  color: z.string().max(64).optional(),
  entityType: z.string().max(64).optional(),
  entityMeta: z.record(z.string(), z.any()).optional(),
  imageUrl: z.string().max(8192).optional(),
  imageMeta: z.record(z.string(), z.any()).optional(),
  /** Omit for max(existing zIndex)+1 in this space (starts at 101 if empty). */
  zIndex: z.number().int().optional(),
  stackId: z.string().uuid().nullable().optional(),
  stackOrder: z.number().int().nullable().optional(),
  /** Maps to `items.entity_type` via `persistedEntityTypeFromCanonical` when `entityType` is omitted. */
  canonical_entity_kind: z
    .enum(["npc", "location", "faction", "quest", "item", "lore", "other"])
    .optional(),
  /** Shell layout for character (v11) / faction (v4 Archive-091) / location (v2–v3). */
  lore_variant: z.enum(["v1", "v2", "v3", "v11"]).optional(),
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
    return jsonValidationError(parsed.error);
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

  let entityType: string | null = parsed.data.entityType?.trim() ?? null;
  if (!entityType && parsed.data.canonical_entity_kind) {
    const ck = normalizeCanonicalEntityKind(parsed.data.canonical_entity_kind);
    entityType = persistedEntityTypeFromCanonical(ck);
  }

  if (isLoreCardPersistedEntityType(entityType) && t !== "note" && t !== "sticky") {
    return Response.json(
      {
        ok: false,
        error: "Lore shells (character / faction / location) require itemType note or sticky",
      },
      { status: 400 },
    );
  }

  let contentText = parsed.data.contentText ?? "";
  const theme = parsed.data.theme ?? "default";

  let contentJson: Record<string, unknown> | null =
    (parsed.data.contentJson as Record<string, unknown> | undefined) ?? null;
  const jsonValidation = validateItemWriteJsonPayload({
    entityType,
    entityMeta: parsed.data.entityMeta,
    contentJson,
    imageMeta: parsed.data.imageMeta,
    routeTag: "POST /api/spaces/[spaceId]/items",
  });
  if (!jsonValidation.ok) {
    return Response.json({ ok: false, error: jsonValidation.error }, { status: 400 });
  }

  const loreVariantRaw = parsed.data.lore_variant;
  const loreVariantForResolve =
    loreVariantRaw === "v1" || loreVariantRaw === "v2" || loreVariantRaw === "v3" || loreVariantRaw === "v11"
      ? loreVariantRaw
      : undefined;

  if (
    contentJson === null &&
    isLoreCardPersistedEntityType(entityType) &&
    (t === "note" || t === "sticky")
  ) {
    const kind = entityType as LoreCardKind;
    const loreCard = resolveLoreCardForCreate({
      kind,
      loreVariant: loreVariantForResolve,
    });
    const synth = synthesizeLoreCardContentJsonAndPlainText({ loreCard });
    contentJson = synth.contentJson;
    if (contentText.trim() === "") {
      contentText = synth.plainText;
    }
  }

  if (parsed.data.contentJson === undefined && t === "note" && contentText.trim() === "") {
    if (!isLoreCardPersistedEntityType(entityType)) {
      return Response.json(
        { ok: false, error: "contentText is required when contentJson is omitted for notes" },
        { status: 400 },
      );
    }
  }

  if (contentJson === null && (t === "note" || t === "sticky" || t === "checklist")) {
    const synthesized = synthesizeContentJsonForCreateItem({
      itemType: t,
      contentText,
      theme,
    });
    if (synthesized) contentJson = synthesized;
  }

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
  const color =
    parsed.data.color ??
    (t === "sticky" ? DS_COLOR.itemDefaultSticky : t === "note" ? DS_COLOR.itemDefaultNote : null);
  const { width: dimW, height: dimH } = defaultItemDimensions(t, entityType);
  const width = parsed.data.width ?? dimW;
  const height = parsed.data.height ?? dimH;
  const zIndex =
    parsed.data.zIndex !== undefined ? parsed.data.zIndex : await nextZIndexForSpace(db, spaceId);

  const searchBlob = buildSearchBlob({
    title,
    contentText,
    contentJson,
    entityType,
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
      width,
      height,
      title,
      contentText,
      searchBlob,
      contentJson,
      color,
      entityType,
      entityMeta: entityMetaForRow,
      imageUrl: parsed.data.imageUrl ?? null,
      imageMeta: parsed.data.imageMeta ?? null,
      zIndex,
      ...(parsed.data.stackId !== undefined ? { stackId: parsed.data.stackId } : {}),
      ...(parsed.data.stackOrder !== undefined ? { stackOrder: parsed.data.stackOrder } : {}),
    })
    .returning();

  if (row && bootCtx.role !== "player") {
    if (contentText.trim().length > 0 || title.trim().length > 0) {
      scheduleVaultReindexAfterResponse(row.id);
    }
  }

  if (row) {
    await publishHeartgardenSpaceInvalidation(db, {
      originSpaceId: spaceId,
      reason: "item.created",
      itemId: row.id,
      lookupSpaceIds: [spaceId],
    });
  }

  return Response.json({ ok: true, item: rowToCanvasItem(row!) });
}
