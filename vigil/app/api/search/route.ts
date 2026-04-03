import OpenAI from "openai";

import { tryGetDb } from "@/src/db/index";
import { rowToCanvasItem } from "@/src/lib/item-mapper";
import {
  assertSpaceExists,
  searchItemsFTS,
  searchItemsHybrid,
  searchItemsSemantic,
} from "@/src/lib/spaces";

export async function GET(req: Request) {
  const db = tryGetDb();
  if (!db) {
    return Response.json({ ok: false, error: "Database not configured", items: [] });
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
  const emb = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: q.slice(0, 8000),
  });
  const vector = emb.data[0]?.embedding;
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
