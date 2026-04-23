import { spaces } from "@/src/db/schema";
import type { HeartgardenApiBootContext } from "@/src/lib/heartgarden-api-boot-context";
import { finalizeHeartgardenSearchFiltersForDb } from "@/src/lib/heartgarden-search-tier-policy";
import { fetchDescendantSpaceIds } from "@/src/lib/heartgarden-space-subtree";
import type { SearchFilters, VigilDb } from "@/src/lib/spaces";

export type LoreImportScopeMode = "current_subtree" | "gm_workspace";

const GM_SCOPE_CONTEXT: HeartgardenApiBootContext = { role: "gm" };

export function applyAllowedSpaceIdsToFilters(
  filters: SearchFilters,
  allowedSpaceIds: Set<string> | null,
): SearchFilters {
  if (!allowedSpaceIds) return filters;
  const next: SearchFilters = { ...filters };
  if (next.spaceIds?.length) {
    next.spaceIds = next.spaceIds.filter((id) => allowedSpaceIds.has(id));
    return next;
  }
  if (next.spaceId) {
    next.spaceIds = allowedSpaceIds.has(next.spaceId) ? [next.spaceId] : [];
    delete next.spaceId;
    return next;
  }
  next.spaceIds = [...allowedSpaceIds];
  return next;
}

function filterSpaceIdsBySearchFilters(
  allSpaceIds: Iterable<string>,
  filters: SearchFilters,
): Set<string> {
  let allowed = new Set(allSpaceIds);
  if (filters.spaceIds?.length) {
    const scoped = new Set(filters.spaceIds);
    allowed = new Set([...allowed].filter((id) => scoped.has(id)));
  } else if (filters.spaceId) {
    allowed = new Set([filters.spaceId]);
  }
  if (filters.excludeSpaceIds?.length) {
    for (const excluded of filters.excludeSpaceIds) {
      allowed.delete(excluded);
    }
  }
  if (filters.excludeSpaceId) {
    allowed.delete(filters.excludeSpaceId);
  }
  return allowed;
}

export async function resolveLoreImportAllowedSpaceIds(args: {
  db: VigilDb;
  rootSpaceId?: string;
  scope: LoreImportScopeMode;
  bootCtx?: HeartgardenApiBootContext;
}): Promise<Set<string>> {
  const { db, rootSpaceId, scope } = args;
  if (scope === "current_subtree") {
    if (!rootSpaceId) {
      throw new Error("rootSpaceId is required for current_subtree scope");
    }
    return fetchDescendantSpaceIds(db, rootSpaceId);
  }
  const baseFilters =
    (await finalizeHeartgardenSearchFiltersForDb(
      db,
      args.bootCtx ?? GM_SCOPE_CONTEXT,
      {},
    )) ?? {};
  const allSpaceIds = (
    await db.select({ id: spaces.id }).from(spaces)
  ).map((row) => row.id);
  return filterSpaceIdsBySearchFilters(allSpaceIds, baseFilters);
}

export function buildSpacePath(
  spaceId: string,
  byId: Map<string, { name: string; parentSpaceId: string | null }>,
): string {
  const labels: string[] = [];
  let current: string | null = spaceId;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    const row = byId.get(current);
    if (!row) break;
    labels.push(row.name);
    current = row.parentSpaceId;
  }
  return labels.reverse().join(" / ");
}
