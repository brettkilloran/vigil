import type { HybridRetrieveOptions } from "@/src/lib/vault-retrieval";

function clampInt(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function parseOptPositiveInt(raw: string | null): number | undefined {
  if (raw === null || raw === "") {
    return;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return;
  }
  return Math.floor(n);
}

/**
 * Optional GET /api/search query overrides for hybrid/semantic modes (bounded).
 * `retrievalMaxItems` caps fused RRF output (distinct from `limit` on SearchFilters for FTS rows in other modes).
 */
export function parseHybridRetrieveQueryParams(
  searchParams: URLSearchParams
): Partial<HybridRetrieveOptions> {
  const out: Partial<HybridRetrieveOptions> = {};
  const fts = parseOptPositiveInt(searchParams.get("ftsLimit"));
  if (fts !== undefined) {
    out.ftsLimit = clampInt(fts, 8, 200);
  }
  const fe = parseOptPositiveInt(searchParams.get("fuzzyLimitEmpty"));
  if (fe !== undefined) {
    out.fuzzyLimitWhenEmpty = clampInt(fe, 8, 100);
  }
  const fs = parseOptPositiveInt(searchParams.get("fuzzyLimitSparse"));
  if (fs !== undefined) {
    out.fuzzyLimitWhenSparse = clampInt(fs, 8, 100);
  }
  const thr = parseOptPositiveInt(searchParams.get("ftsSparseThreshold"));
  if (thr !== undefined) {
    out.ftsSparseThreshold = clampInt(thr, 2, 64);
  }
  const vc = parseOptPositiveInt(searchParams.get("vectorChunkLimit"));
  if (vc !== undefined) {
    out.vectorChunkLimit = clampInt(vc, 8, 200);
  }
  const mc = parseOptPositiveInt(searchParams.get("maxChunksPerItem"));
  if (mc !== undefined) {
    out.maxChunksPerItem = clampInt(mc, 1, 12);
  }
  const rmi = parseOptPositiveInt(searchParams.get("retrievalMaxItems"));
  if (rmi !== undefined) {
    out.maxItems = clampInt(rmi, 8, 80);
  }
  return out;
}
