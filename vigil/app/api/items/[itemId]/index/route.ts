import { eq } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { items } from "@/src/db/schema";
import { reindexItemVault } from "@/src/lib/item-vault-index";
import { vaultItemIndexRateLimitExceeded } from "@/src/lib/vault-index-rate-limit";

export async function POST(
  req: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  if (vaultItemIndexRateLimitExceeded(req)) {
    return Response.json(
      { ok: false, error: "Too many index requests. Try again in a minute." },
      { status: 429 },
    );
  }

  const db = tryGetDb();
  if (!db) {
    return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });
  }

  const { itemId } = await context.params;
  const [row] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);
  if (!row) {
    return Response.json({ ok: false, error: "Not found" }, { status: 404 });
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
    const msg = e instanceof Error ? e.message : "Index failed";
    return Response.json({ ok: false, error: msg }, { status: 502 });
  }
}
