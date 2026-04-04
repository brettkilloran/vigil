import OpenAI from "openai";

import { tryGetDb } from "@/src/db/index";
import { rowToCanvasItem } from "@/src/lib/item-mapper";
import {
  assertSpaceExists,
  type SearchFilters,
  searchItemsFTS,
  searchItemsFuzzy,
  searchItemsHybrid,
  searchItemsSemantic,
} from "@/src/lib/spaces";

const MIN_SEMANTIC_QUERY_LENGTH = 4;
const HYBRID_FTS_SHORT_CIRCUIT_LIMIT = 12;
const EMBEDDING_CACHE_TTL_MS = 10 * 60 * 1000;
const EMBEDDING_CACHE_MAX = 200;

const queryEmbeddingCache = new Map<
  string,
  { vector: number[]; expiresAt: number }
>();
const inFlightEmbeddings = new Map<string, Promise<number[]>>();

function pruneEmbeddingCache(now: number) {
  for (const [k, v] of queryEmbeddingCache) {
    if (v.expiresAt <= now) queryEmbeddingCache.delete(k);
  }
  while (queryEmbeddingCache.size > EMBEDDING_CACHE_MAX) {
    const oldestKey = queryEmbeddingCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    queryEmbeddingCache.delete(oldestKey);
  }
}

async function getQueryEmbedding(openai: OpenAI, query: string): Promise<number[] | null> {
  const key = query.trim().toLowerCase();
  if (!key) return null;
  const now = Date.now();
  const cached = queryEmbeddingCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.vector;
  }
  queryEmbeddingCache.delete(key);

  const existingInFlight = inFlightEmbeddings.get(key);
  if (existingInFlight) {
    return existingInFlight;
  }

  const request = (async () => {
    const emb = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query.slice(0, 8000),
    });
    const vector = emb.data[0]?.embedding;
    if (!vector?.length) return [];
    pruneEmbeddingCache(Date.now());
    queryEmbeddingCache.set(key, {
      vector,
      expiresAt: Date.now() + EMBEDDING_CACHE_TTL_MS,
    });
    return vector;
  })();

  inFlightEmbeddings.set(key, request);
  try {
    return await request;
  } finally {
    inFlightEmbeddings.delete(key);
  }
}

function parseBool(raw: string | null): boolean | undefined {
  if (!raw) return undefined;
  const v = raw.trim().toLowerCase();
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

function parseCsv(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function parseFilters(url: URL): SearchFilters {
  const updatedAfterRaw = url.searchParams.get("updatedAfter");
  const updatedAfter = updatedAfterRaw ? new Date(updatedAfterRaw) : undefined;
  const sortRaw = (url.searchParams.get("sort") ?? "").toLowerCase();
  const sort =
    sortRaw === "title" || sortRaw === "created" || sortRaw === "updated" || sortRaw === "relevance"
      ? sortRaw
      : undefined;
  const limitRaw = Number(url.searchParams.get("limit"));
  return {
    spaceId: url.searchParams.get("spaceId") ?? undefined,
    itemTypes: parseCsv(url.searchParams.get("types")),
    entityTypes: parseCsv(url.searchParams.get("entityTypes")),
    updatedAfter:
      updatedAfter && Number.isFinite(updatedAfter.getTime()) ? updatedAfter : undefined,
    hasLinks: parseBool(url.searchParams.get("hasLinks")),
    inStack: parseBool(url.searchParams.get("inStack")),
    sort,
    limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
  };
}

function mapRows(
  rows: Awaited<ReturnType<typeof searchItemsFTS>>,
) {
  return rows.map((row) => ({
    ...rowToCanvasItem(row.item),
    space: row.space,
  }));
}

export async function GET(req: Request) {
  const db = tryGetDb();
  if (!db) {
    return Response.json({ ok: false, error: "Database not configured", items: [] }, { status: 503 });
  }
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const mode = (url.searchParams.get("mode") ?? "hybrid").toLowerCase();
  const filters = parseFilters(url);

  if (filters.spaceId) {
    const space = await assertSpaceExists(db, filters.spaceId);
    if (!space) {
      return Response.json({ ok: false, error: "Space not found", items: [] }, { status: 404 });
    }
  }

  if (q.length < 2) {
    return Response.json({ ok: true, items: [], mode });
  }

  if (mode === "fts") {
    const rows = await searchItemsFTS(db, q, filters);
    return Response.json({ ok: true, items: mapRows(rows), mode: "fts" });
  }

  if (mode === "fuzzy") {
    const rows = await searchItemsFuzzy(db, q, filters);
    return Response.json({ ok: true, items: mapRows(rows), mode: "fuzzy" });
  }

  if (mode === "hybrid") {
    const ftsRows = await searchItemsFTS(db, q, filters);
    if (ftsRows.length >= HYBRID_FTS_SHORT_CIRCUIT_LIMIT) {
      return Response.json({
        ok: true,
        items: mapRows(ftsRows),
        mode: "hybrid",
      });
    }
  }

  if (q.length < MIN_SEMANTIC_QUERY_LENGTH) {
    const rows = await searchItemsFTS(db, q, filters);
    return Response.json({
      ok: true,
      items: mapRows(rows),
      mode,
      note: `Semantic embedding skipped for short query (<${MIN_SEMANTIC_QUERY_LENGTH} chars)`,
    });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return Response.json(
      {
        ok: false,
        error: "OPENAI_API_KEY not set (required for semantic / hybrid search)",
        items: [],
        mode,
      },
      { status: 503 },
    );
  }

  const openai = new OpenAI({ apiKey: key });
  const vector = await getQueryEmbedding(openai, q);
  if (!vector?.length) {
    return Response.json(
      { ok: false, error: "Embedding request failed", items: [], mode },
      { status: 500 },
    );
  }

  if (mode === "semantic") {
    const rows = await searchItemsSemantic(db, vector, filters);
    return Response.json({
      ok: true,
      items: mapRows(rows),
      mode: "semantic",
    });
  }

  if (mode === "hybrid") {
    const rows = await searchItemsHybrid(db, q, vector, filters);
    return Response.json({
      ok: true,
      items: mapRows(rows),
      mode: "hybrid",
    });
  }

  return Response.json(
    { ok: false, error: "Invalid mode (use fts, fuzzy, semantic, or hybrid)", items: [] },
    { status: 400 },
  );
}
