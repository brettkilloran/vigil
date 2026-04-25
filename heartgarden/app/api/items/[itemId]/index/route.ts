import { eq } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { items } from "@/src/db/schema";
import {
  getHeartgardenApiBootContext,
  gmMayAccessItemSpaceAsync,
  heartgardenApiForbiddenJsonResponse,
  isHeartgardenPlayerBlocked,
  playerMayAccessItemSpaceAsync,
} from "@/src/lib/heartgarden-api-boot-context";
import { jsonPublicError } from "@/src/lib/heartgarden-public-error";
import { reindexItemVault } from "@/src/lib/item-vault-index";
import {
  vaultIndexRateLimitMeta,
  vaultItemIndexRateLimitExceeded,
} from "@/src/lib/vault-index-rate-limit";

export async function POST(
  req: Request,
  context: { params: Promise<{ itemId: string }> }
) {
  const bootCtxEarly = await getHeartgardenApiBootContext();
  if (isHeartgardenPlayerBlocked(bootCtxEarly)) {
    return heartgardenApiForbiddenJsonResponse();
  }

  if (vaultItemIndexRateLimitExceeded(req)) {
    const retry = vaultIndexRateLimitMeta.retry_after_seconds;
    return Response.json(
      {
        ok: false,
        error: "Too many index requests. Try again in a minute.",
        rate_limit: vaultIndexRateLimitMeta,
      },
      {
        status: 429,
        headers: { "Retry-After": String(retry) },
      }
    );
  }

  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { ok: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  const { itemId } = await context.params;
  const [row] = await db
    .select()
    .from(items)
    .where(eq(items.id, itemId))
    .limit(1);
  if (!row) {
    return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  if (!(await playerMayAccessItemSpaceAsync(db, bootCtxEarly, row.spaceId))) {
    return Response.json({ ok: false, error: "Forbidden." }, { status: 403 });
  }
  if (!(await gmMayAccessItemSpaceAsync(db, bootCtxEarly, row.spaceId))) {
    return Response.json({ ok: false, error: "Forbidden." }, { status: 403 });
  }

  let refreshLoreMeta = true;
  const raw = await req.text();
  if (raw.trim()) {
    try {
      const body = JSON.parse(raw) as { refreshLoreMeta?: boolean };
      if (body && typeof body === "object" && body.refreshLoreMeta === false) {
        refreshLoreMeta = false;
      }
    } catch {
      /* ignore */
    }
  }

  try {
    const result = await reindexItemVault(db, itemId, { refreshLoreMeta });
    return Response.json({
      ok: result.ok,
      chunks: result.chunks,
      loreMetaUpdated: result.loreMetaUpdated,
      skipped: result.skipped ?? null,
    });
  } catch (e) {
    console.error("[POST /api/items/:id/index]", e);
    return jsonPublicError(502, "Index failed", "vault_index_failed");
  }
}
