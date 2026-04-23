import { inArray } from "drizzle-orm";

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

/**
 * For import path labels (`buildSpacePath`), load only the spaces needed: under
 * `current_subtree` this is the subtree under `rootSpaceId` plus ancestors up to
 * the workspace root. For `gm_workspace`, all spaces are loaded (same as prior behavior).
 */
export async function loadSpaceMapForLoreImportPathLabels(args: {
  db: VigilDb;
  importScope: LoreImportScopeMode;
  rootSpaceId: string;
}): Promise<Map<string, { name: string; parentSpaceId: string | null }>> {
  if (args.importScope === "current_subtree") {
    const descendants = await fetchDescendantSpaceIds(args.db, args.rootSpaceId);
    const withAncestors = new Set<string>(descendants);
    let frontier = new Set<string>(descendants);
    for (let depth = 0; depth < 64 && frontier.size > 0; depth++) {
      const ids = [...frontier];
      frontier = new Set();
      if (ids.length === 0) break;
      const rows = await args.db
        .select({ id: spaces.id, parentSpaceId: spaces.parentSpaceId })
        .from(spaces)
        .where(inArray(spaces.id, ids));
      for (const r of rows) {
        if (r.parentSpaceId && !withAncestors.has(r.parentSpaceId)) {
          withAncestors.add(r.parentSpaceId);
          frontier.add(r.parentSpaceId);
        }
      }
    }
    if (withAncestors.size === 0) {
      return new Map();
    }
    const spaceRows = await args.db
      .select({
        id: spaces.id,
        name: spaces.name,
        parentSpaceId: spaces.parentSpaceId,
      })
      .from(spaces)
      .where(inArray(spaces.id, [...withAncestors]));
    return new Map(
      spaceRows.map((row) => [
        row.id,
        { name: row.name, parentSpaceId: row.parentSpaceId ?? null },
      ]),
    );
  }
  const spaceRows = await args.db
    .select({
      id: spaces.id,
      name: spaces.name,
      parentSpaceId: spaces.parentSpaceId,
    })
    .from(spaces);
  return new Map(
    spaceRows.map((row) => [
      row.id,
      { name: row.name, parentSpaceId: row.parentSpaceId ?? null },
    ]),
  );
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
