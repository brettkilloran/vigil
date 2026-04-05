import { tryGetDb } from "@/src/db/index";
import {
  enforceGmOnlyBootContext,
  getHeartgardenApiBootContext,
  gmMayAccessSpaceId,
  heartgardenApiForbiddenJsonResponse,
} from "@/src/lib/heartgarden-api-boot-context";
import { reindexSpaceVault } from "@/src/lib/item-vault-index";
import { assertSpaceExists, type VigilDb } from "@/src/lib/spaces";
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
  const space = await assertSpaceExists(db as VigilDb, spaceId);
  if (!space) {
    return Response.json({ ok: false, error: "Space not found" }, { status: 404 });
  }
  if (!gmMayAccessSpaceId(bootCtxEarly, spaceId)) {
    return heartgardenApiForbiddenJsonResponse();
  }

  const result = await reindexSpaceVault(db as VigilDb, spaceId, { refreshLoreMeta });
  return Response.json({
    ok: true,
    items: result.items,
    errors: result.errors,
  });
}
