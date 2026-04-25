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
import { parseSearchFiltersFromUrl } from "@/src/lib/heartgarden-search-url-params";
import { rowToCanvasItem } from "@/src/lib/item-mapper";
import { searchRateLimitExceeded } from "@/src/lib/search-rate-limit";
import {
  assertSpaceExists,
  searchItemsFTS,
  searchItemsFuzzy,
} from "@/src/lib/spaces";
import { hybridRetrieveItems } from "@/src/lib/vault-retrieval";
import { API_SEARCH_HYBRID_OPTIONS } from "@/src/lib/vault-retrieval-profiles";
import { parseHybridRetrieveQueryParams } from "@/src/lib/vault-retrieval-query-params";

function mapRows(rows: Awaited<ReturnType<typeof searchItemsFTS>>) {
  return rows.map((row) => ({
    ...rowToCanvasItem(row.item),
    space: row.space,
  }));
}

export async function GET(req: Request) {
  if (searchRateLimitExceeded(req)) {
    return Response.json(
      {
        ok: false,
        error: "Too many search requests. Try again in a minute.",
        code: "search_rate_limited",
        items: [],
      },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { ok: false, error: "Database not configured", items: [] },
      { status: 503 }
    );
  }
  const bootCtx = await getHeartgardenApiBootContext();
  if (isHeartgardenPlayerBlocked(bootCtx)) {
    return heartgardenApiForbiddenJsonResponse();
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const modeRaw = (url.searchParams.get("mode") ?? "hybrid").toLowerCase();
  const parsedFilters = parseSearchFiltersFromUrl(url, "full");

  const tiered = applySearchTierPolicy(bootCtx, parsedFilters, modeRaw);
  if (!tiered.ok) {
    return heartgardenApiForbiddenJsonResponse();
  }
  const finalized = await finalizeHeartgardenSearchFiltersForDb(
    db,
    bootCtx,
    tiered.filters
  );
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
        Response.json(
          { ok: false, error: "Space not found", items: [] },
          { status: 404 }
        )
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
    // `/api/search` returns rows only (snippets are stripped by `mapRows`); skip
    // `ts_headline` generation in the lexical leg. (`REVIEW_2026-04-25_1835` M5.)
    includeSnippets: false,
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
    const { rows } = await hybridRetrieveItems(
      db,
      q,
      filters,
      hybridRetrieveOpts
    );
    return Response.json({
      ok: true,
      items: mapRows(rows),
      mode: "semantic",
    });
  }

  if (mode === "hybrid") {
    const { rows } = await hybridRetrieveItems(db, q, filters, {
      ...hybridRetrieveOpts,
      includeVector: isEmbeddingApiConfigured(),
    });
    return Response.json({
      ok: true,
      items: mapRows(rows),
      mode: "hybrid",
      ...(isEmbeddingApiConfigured()
        ? {}
        : {
            note: "Lexical hybrid only (no OPENAI_API_KEY; vector fusion disabled).",
          }),
    });
  }

  return Response.json(
    {
      ok: false,
      error: "Invalid mode (use fts, fuzzy, semantic, or hybrid)",
      items: [],
    },
    { status: 400 }
  );
}
