import { eq, sql } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { items } from "@/src/db/schema";
import {
  enforceGmOnlyBootContext,
  getHeartgardenApiBootContext,
} from "@/src/lib/heartgarden-api-boot-context";
import { requireHeartgardenSpaceApiAccess } from "@/src/lib/heartgarden-space-route-access";
import { reindexSpaceVault } from "@/src/lib/item-vault-index";
import type { VigilDb } from "@/src/lib/spaces";
import {
  vaultIndexRateLimitMeta,
  vaultSpaceReindexRateLimitExceeded,
} from "@/src/lib/vault-index-rate-limit";

export async function POST(req: Request, context: { params: Promise<{ spaceId: string }> }) {
  const bootCtxEarly = await getHeartgardenApiBootContext();
  const deniedEarly = enforceGmOnlyBootContext(bootCtxEarly);
  if (deniedEarly) return deniedEarly;

  if (vaultSpaceReindexRateLimitExceeded(req)) {
    const retry = vaultIndexRateLimitMeta.retry_after_seconds;
    return Response.json(
      {
        ok: false,
        error: "Too many reindex requests. Try again in a minute.",
        rate_limit: vaultIndexRateLimitMeta,
      },
      {
        status: 429,
        headers: { "Retry-After": String(retry) },
      },
    );
  }

  const expected = (process.env.HEARTGARDEN_MCP_WRITE_KEY ?? "").trim();
  let writeKey = "";
  let refreshLoreMeta = true;
  let dryRun = false;
  try {
    const j = (await req.json()) as {
      write_key?: string;
      refreshLoreMeta?: boolean;
      refresh_lore_meta?: boolean;
      dry_run?: boolean | string | number;
    };
    writeKey = typeof j.write_key === "string" ? j.write_key.trim() : "";
    if (j.refreshLoreMeta === false || j.refresh_lore_meta === false) refreshLoreMeta = false;
    const dr = j.dry_run;
    if (dr === true || dr === "true" || dr === 1 || dr === "1") dryRun = true;
  } catch {
    return Response.json({ ok: false, error: "Expected JSON body with write_key" }, { status: 400 });
  }

  if (!expected || writeKey !== expected) {
    return Response.json({ ok: false, error: "Invalid or missing write_key" }, { status: 401 });
  }

  const db = tryGetDb();
  if (!db) {
    return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });
  }

  const { spaceId } = await context.params;
  const access = await requireHeartgardenSpaceApiAccess(db, bootCtxEarly, spaceId);
  if (!access.ok) return access.response;

  if (dryRun) {
    const [row] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(items)
      .where(eq(items.spaceId, spaceId));
    const itemCount = row?.c ?? 0;
    return Response.json({
      ok: true,
      dry_run: true,
      space_id: spaceId,
      item_count: itemCount,
      refresh_lore_meta: refreshLoreMeta,
      /** One embedding refresh attempt per item; lore meta uses Anthropic when refresh_lore_meta is true. */
      estimated_embedding_calls: itemCount,
      estimated_anthropic_lore_calls: refreshLoreMeta ? itemCount : 0,
      note: "Commit by POST again with dry_run omitted or false.",
    });
  }

  const result = await reindexSpaceVault(db as VigilDb, spaceId, { refreshLoreMeta });
  return Response.json({
    ok: true,
    items: result.items,
    errors: result.errors,
  });
}
