import { asc, eq, sql } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { items } from "@/src/db/schema";
import {
  getHeartgardenApiBootContext,
  isHeartgardenPlayerBlocked,
} from "@/src/lib/heartgarden-api-boot-context";
import { assertV1ItemsListSpaceAccess } from "@/src/lib/heartgarden-api-item-loaders";
import { rowToCanvasItem } from "@/src/lib/item-mapper";

/**
 * Versioned read-only list for scripts / LLM (no auth in single-user mode).
 * v1 keeps legacy `{ error: string }` failures, while `/api/*` routes use `{ ok: false, error }`.
 */
export async function GET(req: Request) {
  const db = tryGetDb();
  if (!db) {
    return Response.json({ error: "Database not configured" }, { status: 503 });
  }
  const bootCtx = await getHeartgardenApiBootContext();
  if (isHeartgardenPlayerBlocked(bootCtx)) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }
  const url = new URL(req.url);
  const spaceId = url.searchParams.get("space_id");
  if (!spaceId) {
    return Response.json({ error: "space_id required" }, { status: 400 });
  }
  const spaceAccess = await assertV1ItemsListSpaceAccess(db, bootCtx, spaceId);
  if (spaceAccess.kind === "space_absent") {
    if (bootCtx.role === "player") {
      return Response.json({ error: "Forbidden." }, { status: 403 });
    }
    return Response.json({ error: "Space not found" }, { status: 404 });
  }
  if (spaceAccess.kind === "deny") {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const limitRaw = url.searchParams.get("limit");
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);
  if (limitRaw == null && offset > 0) {
    return Response.json({ error: "offset requires limit" }, { status: 400 });
  }

  const [totalRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(items)
    .where(eq(items.spaceId, spaceId));
  const total = totalRow?.c ?? 0;

  let rows;
  let pageLimit: number | undefined;
  if (limitRaw == null) {
    rows = await db
      .select()
      .from(items)
      .where(eq(items.spaceId, spaceId))
      .orderBy(asc(items.zIndex), asc(items.createdAt));
  } else {
    pageLimit = Math.min(Math.max(1, parseInt(limitRaw, 10) || 500), 1000);
    rows = await db
      .select()
      .from(items)
      .where(eq(items.spaceId, spaceId))
      .orderBy(asc(items.zIndex), asc(items.createdAt))
      .limit(pageLimit)
      .offset(offset);
  }

  const payload: Record<string, unknown> = {
    version: 1,
    space_id: spaceId,
    total,
    items: rows.map(rowToCanvasItem),
  };
  if (limitRaw != null && pageLimit != null) {
    payload.limit = pageLimit;
    payload.offset = offset;
  }
  return Response.json(payload);
}
