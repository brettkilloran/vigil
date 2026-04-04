import { tryGetDb } from "@/src/db/index";
import { rowToCanvasItem } from "@/src/lib/item-mapper";
import {
  assertSpaceExists,
  type SearchFilters,
  searchItemsFTS,
  searchItemsFuzzy,
  searchItemsHybrid,
} from "@/src/lib/spaces";

const HYBRID_FTS_SHORT_CIRCUIT_LIMIT = 12;

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

function mapRows(rows: Awaited<ReturnType<typeof searchItemsFTS>>) {
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

  /** Legacy alias: vector semantic search was removed; same as FTS. */
  if (mode === "semantic") {
    const rows = await searchItemsFTS(db, q, filters);
    return Response.json({
      ok: true,
      items: mapRows(rows),
      mode: "fts",
      note: "mode=semantic is deprecated; results use full-text search only.",
    });
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
    const rows = await searchItemsHybrid(db, q, filters);
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
