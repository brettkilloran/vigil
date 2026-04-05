import { tryGetDb } from "@/src/db/index";
import {
  enforceGmOnlyBootContext,
  getHeartgardenApiBootContext,
} from "@/src/lib/heartgarden-api-boot-context";
import { assertSpaceExists, type SearchFilters, type VigilDb } from "@/src/lib/spaces";
import { embedTexts, isEmbeddingApiConfigured } from "@/src/lib/embedding-provider";
import { searchItemChunksByVector } from "@/src/lib/vault-retrieval";

function parseFilters(url: URL): SearchFilters {
  const limitRaw = Number(url.searchParams.get("limit"));
  return {
    spaceId: url.searchParams.get("spaceId") ?? undefined,
    limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
  };
}

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
  const filters = parseFilters(url);

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
      note: "OPENAI_API_KEY not set; semantic chunk search unavailable.",
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
