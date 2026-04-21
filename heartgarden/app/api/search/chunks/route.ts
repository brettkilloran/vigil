import { tryGetDb } from "@/src/db/index";
import {
  enforceGmOnlyBootContext,
  getHeartgardenApiBootContext,
  gmMayAccessSpaceIdAsync,
  heartgardenApiForbiddenJsonResponse,
} from "@/src/lib/heartgarden-api-boot-context";
import { finalizeHeartgardenSearchFiltersForDb } from "@/src/lib/heartgarden-search-tier-policy";
import { parseSearchFiltersFromUrl } from "@/src/lib/heartgarden-search-url-params";
import { assertSpaceExists, type VigilDb } from "@/src/lib/spaces";
import { embedTexts, isEmbeddingApiConfigured } from "@/src/lib/embedding-provider";
import { searchItemChunksByVector } from "@/src/lib/vault-retrieval";

export async function GET(req: Request) {
  const bootCtx = await getHeartgardenApiBootContext();
  const denied = enforceGmOnlyBootContext(bootCtx);
  if (denied) return denied;

  const db = tryGetDb();
  if (!db) {
    return Response.json({ ok: false, error: "Database not configured", chunks: [] }, { status: 503 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const parsed = parseSearchFiltersFromUrl(url, "chunks");

  if (parsed.spaceId && !(await gmMayAccessSpaceIdAsync(db as VigilDb, bootCtx, parsed.spaceId))) {
    return heartgardenApiForbiddenJsonResponse();
  }

  const finalized = await finalizeHeartgardenSearchFiltersForDb(db as VigilDb, bootCtx, parsed);
  if (!finalized) {
    return heartgardenApiForbiddenJsonResponse();
  }
  const filters = finalized;

  if (filters.spaceId) {
    const space = await assertSpaceExists(db as VigilDb, filters.spaceId);
    if (!space) {
      return Response.json({ ok: false, error: "Space not found", chunks: [] }, { status: 404 });
    }
  }

  if (q.length < 2) {
    return Response.json({ ok: true, chunks: [], note: "Query too short" });
  }

  if (!isEmbeddingApiConfigured()) {
    return Response.json({
      ok: true,
      chunks: [],
      note: "Vector chunk search unavailable (no embedding provider configured).",
    });
  }

  const limit = Math.min(48, Math.max(1, filters.limit ?? 24));

  try {
    const [qEmb] = await embedTexts([q.slice(0, 8000)]);
    const hits = await searchItemChunksByVector(db as VigilDb, qEmb, filters, limit);
    return Response.json({
      ok: true,
      chunks: hits.map((h) => ({
        itemId: h.itemId,
        title: h.item.title?.trim() || "Untitled",
        spaceId: h.space.id,
        spaceName: h.space.name,
        chunkIndex: h.chunkIndex,
        chunk: h.chunkText,
        distance: h.distance,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Semantic search failed";
    return Response.json({ ok: false, error: msg, chunks: [] }, { status: 502 });
  }
}
