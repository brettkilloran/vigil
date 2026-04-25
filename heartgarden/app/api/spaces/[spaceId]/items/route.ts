import { eq, sql } from "drizzle-orm";
import { after } from "next/server";
import { z } from "zod";

import type { LoreCardKind } from "@/src/components/foundation/architectural-types";
import { tryGetDb } from "@/src/db/index";
import { items } from "@/src/db/schema";
import { DS_COLOR } from "@/src/lib/design-system-tokens";
import {
  getHeartgardenApiBootContext,
  heartgardenApiForbiddenJsonResponse,
} from "@/src/lib/heartgarden-api-boot-context";
import { validateItemWriteJsonPayload } from "@/src/lib/heartgarden-item-json-schema";
import { publishHeartgardenSpaceInvalidation } from "@/src/lib/heartgarden-realtime-invalidation";
import { requireHeartgardenSpaceApiAccess } from "@/src/lib/heartgarden-space-route-access";
import { jsonValidationError } from "@/src/lib/heartgarden-validation-error";
import {
  defaultItemDimensions,
  nextZIndexForSpace,
  synthesizeContentJsonForCreateItem,
} from "@/src/lib/item-create-defaults";
import { rowToCanvasItem } from "@/src/lib/item-mapper";
import { normalizeCanonicalEntityKind } from "@/src/lib/lore-import-canonical-kinds";
import {
  resolveLoreCardForCreate,
  synthesizeLoreCardContentJsonAndPlainText,
} from "@/src/lib/lore-item-create-synthesis";
import {
  isLoreCardPersistedEntityType,
  persistedEntityTypeFromCanonical,
} from "@/src/lib/lore-object-registry";
import {
  playersMayCreateItemType,
  stripGmOnlyEntityMetaPatch,
} from "@/src/lib/player-item-policy";
import { scheduleVaultReindexAfterResponse } from "@/src/lib/schedule-vault-index-after";
import { buildSearchBlob } from "@/src/lib/search-blob";
import { listItemsForSpace } from "@/src/lib/spaces";

const createBody = z.object({
  /** Maps to `items.entity_type` via `persistedEntityTypeFromCanonical` when `entityType` is omitted. */
  canonical_entity_kind: z
    .enum(["npc", "location", "faction", "quest", "item", "lore", "other"])
    .optional(),
  color: z.string().max(64).optional(),
  contentJson: z.record(z.string(), z.any()).optional(),
  contentText: z.string().optional(),
  entityMeta: z.record(z.string(), z.any()).optional(),
  entityType: z.string().max(64).optional(),
  height: z.number().positive().max(4000).optional(),
  /** When set, insert this row id (used for undo-after-delete restore). Must not already exist. */
  id: z.string().uuid().optional(),
  imageMeta: z.record(z.string(), z.any()).optional(),
  imageUrl: z.string().max(8192).optional(),
  itemType: z.enum([
    "note",
    "sticky",
    "image",
    "checklist",
    "webclip",
    "folder",
  ]),
  /** Shell layout for character (v11) / faction (v4 Archive-091) / location (v2–v3). */
  lore_variant: z.enum(["v1", "v2", "v3", "v11"]).optional(),
  stackId: z.string().uuid().nullable().optional(),
  stackOrder: z.number().int().nullable().optional(),
  /** Applied when synthesizing `contentJson` for note/sticky (default/code/task). */
  theme: z.enum(["default", "code", "task"]).optional(),
  title: z.string().max(255).optional(),
  /** Omit for type-based defaults (e.g. note 340×270, checklist 340×188, character 340×453). */
  width: z.number().positive().max(4000).optional(),
  x: z.number().default(0),
  y: z.number().default(0),
  /** Omit for max(existing zIndex)+1 in this space (starts at 101 if empty). */
  zIndex: z.number().int().optional(),
});

/**
 * Default page size for the items list. Unbounded responses at thousands of items
 * per space were a real risk for any v1 / MCP / script caller that omitted
 * `?limit=`; they would receive tens of MB on large spaces. Add a default limit
 * (with `limit=all` as an explicit opt-out for export tooling) and surface
 * `total` + `nextOffset` so callers can page deterministically.
 * (`REVIEW_2026-04-25_1835` M2.)
 */
const DEFAULT_ITEMS_LIST_LIMIT = 500;
const MAX_ITEMS_LIST_LIMIT = 1000;

export async function GET(
  req: Request,
  context: { params: Promise<{ spaceId: string }> }
) {
  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { error: "Database not configured", ok: false },
      { status: 503 }
    );
  }
  const bootCtx = await getHeartgardenApiBootContext();
  const { spaceId } = await context.params;
  const access = await requireHeartgardenSpaceApiAccess(db, bootCtx, spaceId);
  if (!access.ok) {
    return access.response;
  }

  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit");
  const offsetRaw = url.searchParams.get("offset");
  const wantAll = limitRaw === "all";
  const offset = Math.max(0, Number.parseInt(offsetRaw ?? "0", 10) || 0);
  let limit: number | undefined;
  if (!wantAll) {
    if (limitRaw == null) {
      limit = DEFAULT_ITEMS_LIST_LIMIT;
    } else {
      const parsed = Number.parseInt(limitRaw, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return Response.json(
          { error: 'limit must be a positive integer or "all"', ok: false },
          { status: 400 }
        );
      }
      limit = Math.min(parsed, MAX_ITEMS_LIST_LIMIT);
    }
  }

  const [totalRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(items)
    .where(eq(items.spaceId, spaceId));
  const total = totalRow?.c ?? 0;

  const rows = await listItemsForSpace(db, spaceId, { limit, offset });
  const payload: Record<string, unknown> = {
    items: rows.map(rowToCanvasItem),
    offset,
    ok: true,
    total,
  };
  if (limit != null) {
    payload.limit = limit;
    const next = offset + rows.length;
    payload.nextOffset = next < total ? next : null;
  }
  return Response.json(payload);
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: POST creates an item with optional content_json/text/markdown precedence, kind/entity-meta normalization, and z-index allocation
export async function POST(
  req: Request,
  context: { params: Promise<{ spaceId: string }> }
) {
  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { error: "Database not configured", ok: false },
      { status: 503 }
    );
  }
  const bootCtx = await getHeartgardenApiBootContext();
  const { spaceId } = await context.params;
  const access = await requireHeartgardenSpaceApiAccess(db, bootCtx, spaceId);
  if (!access.ok) {
    return access.response;
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON", ok: false }, { status: 400 });
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
    if (
      parsed.data.imageUrl !== undefined ||
      parsed.data.imageMeta !== undefined
    ) {
      return heartgardenApiForbiddenJsonResponse();
    }
    if (parsed.data.id !== undefined) {
      return heartgardenApiForbiddenJsonResponse();
    }
  }

  if (parsed.data.id) {
    const [existing] = await db
      .select()
      .from(items)
      .where(eq(items.id, parsed.data.id))
      .limit(1);
    if (existing) {
      return Response.json(
        { error: "Item id already exists", ok: false },
        { status: 409 }
      );
    }
  }

  const entityMetaForRow =
    bootCtx.role === "player"
      ? (stripGmOnlyEntityMetaPatch(
          parsed.data.entityMeta as Record<string, unknown> | undefined
        ) ?? null)
      : (parsed.data.entityMeta ?? null);

  let entityType: string | null = parsed.data.entityType?.trim() ?? null;
  if (!entityType && parsed.data.canonical_entity_kind) {
    const ck = normalizeCanonicalEntityKind(parsed.data.canonical_entity_kind);
    entityType = persistedEntityTypeFromCanonical(ck);
  }
  if (entityType === "") {
    entityType = null;
  } else if (entityType) {
    entityType = entityType.toLowerCase();
  }

  if (
    isLoreCardPersistedEntityType(entityType) &&
    t !== "note" &&
    t !== "sticky"
  ) {
    return Response.json(
      {
        error:
          "Lore shells (character / faction / location) require itemType note or sticky",
        ok: false,
      },
      { status: 400 }
    );
  }

  let contentText = parsed.data.contentText ?? "";
  const theme = parsed.data.theme ?? "default";

  let contentJson: Record<string, unknown> | null =
    (parsed.data.contentJson as Record<string, unknown> | undefined) ?? null;
  const jsonValidation = validateItemWriteJsonPayload({
    contentJson,
    entityMeta: parsed.data.entityMeta,
    entityType,
    imageMeta: parsed.data.imageMeta,
    routeTag: "POST /api/spaces/[spaceId]/items",
  });
  if (!jsonValidation.ok) {
    return Response.json(
      { error: jsonValidation.error, ok: false },
      { status: 400 }
    );
  }

  const loreVariantRaw = parsed.data.lore_variant;
  const loreVariantForResolve =
    loreVariantRaw === "v1" ||
    loreVariantRaw === "v2" ||
    loreVariantRaw === "v3" ||
    loreVariantRaw === "v11"
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

  if (
    parsed.data.contentJson === undefined &&
    t === "note" &&
    contentText.trim() === "" &&
    !isLoreCardPersistedEntityType(entityType)
  ) {
    return Response.json(
      {
        error: "contentText is required when contentJson is omitted for notes",
        ok: false,
      },
      { status: 400 }
    );
  }

  if (
    contentJson === null &&
    (t === "note" || t === "sticky" || t === "checklist")
  ) {
    const synthesized = synthesizeContentJsonForCreateItem({
      contentText,
      itemType: t,
      theme,
    });
    if (synthesized) {
      contentJson = synthesized;
    }
  }

  const DEFAULT_TITLES: Record<string, string> = {
    checklist: "Checklist",
    folder: "Folder",
    note: "Note",
    sticky: "Sticky",
    webclip: "Web clip",
  };
  const defaultTitle = DEFAULT_TITLES[t] ?? "Item";
  const title = parsed.data.title?.trim() || defaultTitle;
  const DEFAULT_ITEM_COLORS: Record<string, string | null> = {
    note: DS_COLOR.itemDefaultNote,
    sticky: DS_COLOR.itemDefaultSticky,
  };
  const color = parsed.data.color ?? DEFAULT_ITEM_COLORS[t] ?? null;
  const { width: dimW, height: dimH } = defaultItemDimensions(t, entityType);
  const width = parsed.data.width ?? dimW;
  const height = parsed.data.height ?? dimH;
  const zIndex =
    parsed.data.zIndex === undefined
      ? await nextZIndexForSpace(db, spaceId)
      : parsed.data.zIndex;

  const searchBlob = buildSearchBlob({
    contentJson,
    contentText,
    entityMeta: entityMetaForRow,
    entityType,
    imageMeta: parsed.data.imageMeta ?? null,
    imageUrl: parsed.data.imageUrl ?? null,
    loreAliases: null,
    loreSummary: null,
    title,
  });

  const [row] = await db
    .insert(items)
    .values({
      ...(parsed.data.id ? { id: parsed.data.id } : {}),
      color,
      contentJson,
      contentText,
      entityMeta: entityMetaForRow,
      entityType,
      height,
      imageMeta: parsed.data.imageMeta ?? null,
      imageUrl: parsed.data.imageUrl ?? null,
      itemType: t,
      searchBlob,
      spaceId,
      title,
      width,
      x: parsed.data.x,
      y: parsed.data.y,
      zIndex,
      ...(parsed.data.stackId === undefined
        ? {}
        : { stackId: parsed.data.stackId }),
      ...(parsed.data.stackOrder === undefined
        ? {}
        : { stackOrder: parsed.data.stackOrder }),
    })
    .returning();

  if (
    row &&
    bootCtx.role !== "player" &&
    (contentText.trim().length > 0 || title.trim().length > 0)
  ) {
    scheduleVaultReindexAfterResponse(row.id);
  }

  if (row) {
    after(async () => {
      await publishHeartgardenSpaceInvalidation(db, {
        itemId: row.id,
        lookupSpaceIds: [spaceId],
        originSpaceId: spaceId,
        reason: "item.created",
      });
    });
  }

  return Response.json({ item: rowToCanvasItem(row!), ok: true });
}
