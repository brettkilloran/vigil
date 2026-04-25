/**
 * Shared query-string parsing for `/api/search`, `/api/search/suggest`, and `/api/search/chunks`.
 * Keep behavior aligned across routes; unit tests lock golden URLs.
 */
import type { SearchFilters } from "@/src/lib/spaces";

export function parseBool(raw: string | null): boolean | undefined {
  if (!raw) {
    return;
  }
  const v = raw.trim().toLowerCase();
  if (v === "true") {
    return true;
  }
  if (v === "false") {
    return false;
  }
  return;
}

export function parseCsv(raw: string | null): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export type SearchUrlVariant = "full" | "suggest" | "chunks";

/**
 * Parse `SearchFilters` from a request URL the same way legacy inline `parseFilters` did per route.
 */
export function parseSearchFiltersFromUrl(
  url: URL,
  variant: SearchUrlVariant
): SearchFilters {
  if (variant === "chunks") {
    const limitRaw = Number(url.searchParams.get("limit"));
    return {
      limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
      spaceId: url.searchParams.get("spaceId") ?? undefined,
    };
  }

  if (variant === "suggest") {
    const limitRaw = Number(url.searchParams.get("limit"));
    return {
      canonicalEntityKinds: parseCsv(url.searchParams.get("canonicalKind")),
      entityTypes: parseCsv(url.searchParams.get("entityTypes")),
      hasLinks: parseBool(url.searchParams.get("hasLinks")),
      inStack: parseBool(url.searchParams.get("inStack")),
      itemTypes: parseCsv(url.searchParams.get("types")),
      limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
      spaceId: url.searchParams.get("spaceId") ?? undefined,
    };
  }

  const updatedAfterRaw = url.searchParams.get("updatedAfter");
  const updatedAfter = updatedAfterRaw ? new Date(updatedAfterRaw) : undefined;
  const sortRaw = (url.searchParams.get("sort") ?? "").toLowerCase();
  const sort =
    sortRaw === "title" ||
    sortRaw === "created" ||
    sortRaw === "updated" ||
    sortRaw === "relevance"
      ? sortRaw
      : undefined;
  const limitRaw = Number(url.searchParams.get("limit"));
  const minEpochRaw = Number(url.searchParams.get("minCampaignEpoch"));
  return {
    canonicalEntityKinds: parseCsv(url.searchParams.get("canonicalKind")),
    entityTypes: parseCsv(url.searchParams.get("entityTypes")),
    excludeLoreHistorical: parseBool(
      url.searchParams.get("excludeLoreHistorical")
    ),
    hasLinks: parseBool(url.searchParams.get("hasLinks")),
    inStack: parseBool(url.searchParams.get("inStack")),
    itemTypes: parseCsv(url.searchParams.get("types")),
    limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
    minCampaignEpoch: Number.isFinite(minEpochRaw)
      ? Math.floor(minEpochRaw)
      : undefined,
    sort,
    spaceId: url.searchParams.get("spaceId") ?? undefined,
    updatedAfter:
      updatedAfter && Number.isFinite(updatedAfter.getTime())
        ? updatedAfter
        : undefined,
  };
}
