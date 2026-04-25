import { tryGetDb } from "@/src/db/index";
import {
  embedTexts,
  isEmbeddingApiConfigured,
} from "@/src/lib/embedding-provider";
import {
  enforceGmOnlyBootContext,
  getHeartgardenApiBootContext,
  gmMayAccessSpaceIdAsync,
  heartgardenApiForbiddenJsonResponse,
} from "@/src/lib/heartgarden-api-boot-context";
import { jsonPublicError } from "@/src/lib/heartgarden-public-error";
import { finalizeHeartgardenSearchFiltersForDb } from "@/src/lib/heartgarden-search-tier-policy";
import { parseSearchFiltersFromUrl } from "@/src/lib/heartgarden-search-url-params";
import { assertSpaceExists, type VigilDb } from "@/src/lib/spaces";
import { searchItemChunksByVector } from "@/src/lib/vault-retrieval";

export async function GET(req: Request) {
  const bootCtx = await getHeartgardenApiBootContext();
  const denied = enforceGmOnlyBootContext(bootCtx);
  if (denied) {
    return denied;
  }

  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { chunks: [], error: "Database not configured", ok: false },
      { status: 503 }
    );
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const parsed = parseSearchFiltersFromUrl(url, "chunks");

  if (
    parsed.spaceId &&
    !(await gmMayAccessSpaceIdAsync(db as VigilDb, bootCtx, parsed.spaceId))
  ) {
    return heartgardenApiForbiddenJsonResponse();
  }

  const finalized = await finalizeHeartgardenSearchFiltersForDb(
    db as VigilDb,
    bootCtx,
    parsed
  );
  if (!finalized) {
    return heartgardenApiForbiddenJsonResponse();
  }
  const filters = finalized;

  if (filters.spaceId) {
    const space = await assertSpaceExists(db as VigilDb, filters.spaceId);
    if (!space) {
      return Response.json(
        { chunks: [], error: "Space not found", ok: false },
        { status: 404 }
      );
    }
  }

  if (q.length < 2) {
    return Response.json({ chunks: [], note: "Query too short", ok: true });
  }

  if (!isEmbeddingApiConfigured()) {
    return Response.json({
      chunks: [],
      note: "Vector chunk search unavailable (no embedding provider configured).",
      ok: true,
    });
  }

  const limit = Math.min(48, Math.max(1, filters.limit ?? 24));

  try {
    const [qEmb] = await embedTexts([q.slice(0, 8000)]);
    const hits = await searchItemChunksByVector(
      db as VigilDb,
      qEmb,
      filters,
      limit
    );
    return Response.json({
      chunks: hits.map((h) => ({
        chunk: h.chunkText,
        chunkIndex: h.chunkIndex,
        distance: h.distance,
        headingPath: h.headingPath,
        itemId: h.itemId,
        spaceId: h.space.id,
        spaceName: h.space.name,
        title: h.item.title?.trim() || "Untitled",
      })),
      ok: true,
    });
  } catch (e) {
    console.error("[GET /api/search/chunks]", e);
    return jsonPublicError(
      502,
      "Semantic search failed",
      "search_chunks_failed",
      { chunks: [] }
    );
  }
}
