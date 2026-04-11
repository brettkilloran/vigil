import { tryGetDb } from "@/src/db/index";
import { isEmbeddingApiConfigured } from "@/src/lib/embedding-provider";
import {
  getHeartgardenApiBootContext,
  gmMayAccessSpaceIdAsync,
  heartgardenApiForbiddenJsonResponse,
  heartgardenMaskNotFoundForPlayer,
  isHeartgardenPlayerBlocked,
} from "@/src/lib/heartgarden-api-boot-context";
import {
  applySearchTierPolicy,
  finalizeHeartgardenSearchFiltersForDb,
} from "@/src/lib/heartgarden-search-tier-policy";
import { rowToCanvasItem } from "@/src/lib/item-mapper";
import {
  assertSpaceExists,
  type SearchFilters,
  searchItemsFTS,
  searchItemsFuzzy,
  searchItemsHybrid,
} from "@/src/lib/spaces";
import { parseHybridRetrieveQueryParams } from "@/src/lib/vault-retrieval-query-params";
import { API_SEARCH_HYBRID_OPTIONS } from "@/src/lib/vault-retrieval-profiles";
import { hybridRetrieveItems } from "@/src/lib/vault-retrieval";

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
  const minEpochRaw = Number(url.searchParams.get("minCampaignEpoch"));
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
    minCampaignEpoch: Number.isFinite(minEpochRaw) ? Math.floor(minEpochRaw) : undefined,
    excludeLoreHistorical: parseBool(url.searchParams.get("excludeLoreHistorical")),
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
  const bootCtx = await getHeartgardenApiBootContext();
  if (isHeartgardenPlayerBlocked(bootCtx)) {
    return heartgardenApiForbiddenJsonResponse();
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const modeRaw = (url.searchParams.get("mode") ?? "hybrid").toLowerCase();
  const parsedFilters = parseFilters(url);

  const tiered = applySearchTierPolicy(bootCtx, parsedFilters, modeRaw);
  if (!tiered.ok) {
    return heartgardenApiForbiddenJsonResponse();
  }
  const finalized = await finalizeHeartgardenSearchFiltersForDb(db, bootCtx, tiered.filters);
  if (!finalized) {
    return heartgardenApiForbiddenJsonResponse();
  }
  const { mode } = tiered;
  const filters = finalized;

  if (
    bootCtx.role === "gm" &&
    filters.spaceId &&
    !(await gmMayAccessSpaceIdAsync(db, bootCtx, filters.spaceId))
  ) {
    return heartgardenApiForbiddenJsonResponse();
  }

  if (filters.spaceId) {
    const space = await assertSpaceExists(db, filters.spaceId);
    if (!space) {
      return heartgardenMaskNotFoundForPlayer(
        bootCtx,
        Response.json({ ok: false, error: "Space not found", items: [] }, { status: 404 }),
      );
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

  const hybridQueryOverrides = parseHybridRetrieveQueryParams(url.searchParams);
  const retrievalBaseLimit = Math.min(80, Math.max(8, filters.limit ?? 24));
  const hybridRetrieveOpts = {
    ...API_SEARCH_HYBRID_OPTIONS,
    ...hybridQueryOverrides,
    maxItems: hybridQueryOverrides.maxItems ?? retrievalBaseLimit,
    includeVector: true as const,
  };

  if (mode === "semantic") {
    if (!isEmbeddingApiConfigured()) {
      const rows = await searchItemsFTS(db, q, filters);
      return Response.json({
        ok: true,
        items: mapRows(rows),
        mode: "fts",
        note: "Vector search unavailable; fell back to full-text search.",
      });
    }
    const { rows } = await hybridRetrieveItems(db, q, filters, hybridRetrieveOpts);
    return Response.json({
      ok: true,
      items: mapRows(rows),
      mode: "semantic",
    });
  }

  if (mode === "hybrid") {
    if (isEmbeddingApiConfigured()) {
      const { rows } = await hybridRetrieveItems(db, q, filters, hybridRetrieveOpts);
      return Response.json({
        ok: true,
        items: mapRows(rows),
        mode: "hybrid",
      });
    }

    const ftsRows = await searchItemsFTS(db, q, filters);
    if (ftsRows.length >= HYBRID_FTS_SHORT_CIRCUIT_LIMIT) {
      return Response.json({
        ok: true,
        items: mapRows(ftsRows),
        mode: "hybrid",
        note: "Lexical hybrid only (no embedding provider; vector fusion disabled).",
      });
    }
    const rows = await searchItemsHybrid(db, q, filters);
    return Response.json({
      ok: true,
      items: mapRows(rows),
      mode: "hybrid",
      note: "Lexical hybrid only (no embedding provider; vector fusion disabled).",
    });
  }

  return Response.json(
    { ok: false, error: "Invalid mode (use fts, fuzzy, semantic, or hybrid)", items: [] },
    { status: 400 },
  );
}
