import OpenAI from "openai";

import { tryGetDb } from "@/src/db/index";
import { rowToCanvasItem } from "@/src/lib/item-mapper";
import {
  assertSpaceExists,
  searchItemsFTS,
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

export async function GET(req: Request) {
  const db = tryGetDb();
  if (!db) {
    return Response.json({ ok: false, error: "Database not configured", items: [] }, { status: 503 });
  }
  const url = new URL(req.url);
  const spaceId = url.searchParams.get("spaceId");
  const q = (url.searchParams.get("q") ?? "").trim();
  const mode = (url.searchParams.get("mode") ?? "fts").toLowerCase();

  if (!spaceId) {
    return Response.json({ ok: false, error: "spaceId required", items: [] }, { status: 400 });
  }
  const space = await assertSpaceExists(db, spaceId);
  if (!space) {
    return Response.json({ ok: false, error: "Space not found", items: [] }, { status: 404 });
  }

  if (q.length < 2) {
    return Response.json({ ok: true, items: [], mode });
  }

  if (mode === "fts") {
    const rows = await searchItemsFTS(db, spaceId, q);
    return Response.json({ ok: true, items: rows.map(rowToCanvasItem), mode: "fts" });
  }

  if (mode === "hybrid") {
    const ftsRows = await searchItemsFTS(db, spaceId, q);
    if (ftsRows.length >= HYBRID_FTS_SHORT_CIRCUIT_LIMIT) {
      return Response.json({
        ok: true,
        items: ftsRows.map(rowToCanvasItem),
        mode: "hybrid",
      });
    }
  }

  if (q.length < MIN_SEMANTIC_QUERY_LENGTH) {
    const rows = await searchItemsFTS(db, spaceId, q);
    return Response.json({
      ok: true,
      items: rows.map(rowToCanvasItem),
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
    const rows = await searchItemsSemantic(db, spaceId, vector);
    return Response.json({
      ok: true,
      items: rows.map(rowToCanvasItem),
      mode: "semantic",
    });
  }

  if (mode === "hybrid") {
    const rows = await searchItemsHybrid(db, spaceId, q, vector);
    return Response.json({
      ok: true,
      items: rows.map(rowToCanvasItem),
      mode: "hybrid",
    });
  }

  return Response.json(
    { ok: false, error: "Invalid mode (use fts, semantic, or hybrid)", items: [] },
    { status: 400 },
  );
}
