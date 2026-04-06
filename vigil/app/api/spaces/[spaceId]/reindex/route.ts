import { tryGetDb } from "@/src/db/index";
import {
  enforceGmOnlyBootContext,
  getHeartgardenApiBootContext,
} from "@/src/lib/heartgarden-api-boot-context";
import { requireHeartgardenSpaceApiAccess } from "@/src/lib/heartgarden-space-route-access";
import { reindexSpaceVault } from "@/src/lib/item-vault-index";
import type { VigilDb } from "@/src/lib/spaces";
import { vaultSpaceReindexRateLimitExceeded } from "@/src/lib/vault-index-rate-limit";

export async function POST(req: Request, context: { params: Promise<{ spaceId: string }> }) {
  const bootCtxEarly = await getHeartgardenApiBootContext();
  const deniedEarly = enforceGmOnlyBootContext(bootCtxEarly);
  if (deniedEarly) return deniedEarly;

  if (vaultSpaceReindexRateLimitExceeded(req)) {
    return Response.json(
      { ok: false, error: "Too many reindex requests. Try again in a minute." },
      { status: 429 },
    );
  }

  const expected = (process.env.HEARTGARDEN_MCP_WRITE_KEY ?? "").trim();
  let writeKey = "";
  let refreshLoreMeta = true;
  try {
    const j = (await req.json()) as { write_key?: string; refreshLoreMeta?: boolean };
    writeKey = typeof j.write_key === "string" ? j.write_key.trim() : "";
    if (j.refreshLoreMeta === false) refreshLoreMeta = false;
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

  const result = await reindexSpaceVault(db as VigilDb, spaceId, { refreshLoreMeta });
  return Response.json({
    ok: true,
    items: result.items,
    errors: result.errors,
  });
}
