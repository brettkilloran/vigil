import { spaces } from "@/src/db/schema";
import {
  heartgardenPlayerSpaceIdExcludedFromGm,
  type HeartgardenApiBootContext,
  playerMayAccessSpaceIdAsync,
} from "@/src/lib/heartgarden-api-boot-context";
import { isHeartgardenGmPlayerSpaceBreakGlassEnabled } from "@/src/lib/heartgarden-gm-break-glass";
import { collectDescendantSpaceIds } from "@/src/lib/heartgarden-space-subtree";
import {
  findImplicitPlayerRootSpaceId,
  type SearchFilters,
  type VigilDb,
} from "@/src/lib/spaces";

export type SearchTierPolicyResult =
  | { ok: false }
  | { ok: true; filters: SearchFilters; mode: string };

/**
 * Centralizes `/api/search` tier rules: Players use fts-only; GM global search excludes Players space.
 * Player space scoping (root vs folder vs full subtree) is applied in
 * {@link finalizeHeartgardenSearchFiltersForDb}.
 */
export function applySearchTierPolicy(
  ctx: HeartgardenApiBootContext,
  filters: SearchFilters,
  modeRaw: string,
): SearchTierPolicyResult {
  const mode = modeRaw.toLowerCase();
  const hid = heartgardenPlayerSpaceIdExcludedFromGm();

  if (ctx.role === "player") {
    const nextFilters = { ...filters };
    let m = mode;
    if (m === "hybrid" || m === "semantic") m = "fts";
    return { ok: true, filters: nextFilters, mode: m };
  }

  if (ctx.role === "gm" && hid && !filters.spaceId && !isHeartgardenGmPlayerSpaceBreakGlassEnabled()) {
    return { ok: true, filters: { ...filters, excludeSpaceId: hid }, mode };
  }

  return { ok: true, filters: { ...filters }, mode };
}

/** `/api/search/suggest` — same space rules as search (no mode). */
export function applySuggestTierPolicy(
  ctx: HeartgardenApiBootContext,
  filters: SearchFilters,
): SearchTierPolicyResult {
  const hid = heartgardenPlayerSpaceIdExcludedFromGm();

  if (ctx.role === "player") {
    return { ok: true, filters: { ...filters }, mode: "" };
  }

  if (ctx.role === "gm" && hid && !filters.spaceId && !isHeartgardenGmPlayerSpaceBreakGlassEnabled()) {
    return { ok: true, filters: { ...filters, excludeSpaceId: hid }, mode: "" };
  }

  return { ok: true, filters: { ...filters }, mode: "" };
}

/**
 * DB-backed search filter shaping: player folder + subtree scope; GM excludes full player-world subtree.
 */
export async function finalizeHeartgardenSearchFiltersForDb(
  db: VigilDb,
  ctx: HeartgardenApiBootContext,
  filters: SearchFilters,
): Promise<SearchFilters | null> {
  if (ctx.role === "player") {
    const next: SearchFilters = { ...filters };
    if (next.spaceId) {
      if (!(await playerMayAccessSpaceIdAsync(db, ctx, next.spaceId))) return null;
      return next;
    }
    const slim = await db
      .select({ id: spaces.id, parentSpaceId: spaces.parentSpaceId })
      .from(spaces);
    next.spaceIds = [...collectDescendantSpaceIds(ctx.playerSpaceId, slim)];
    delete next.spaceId;
    return next;
  }

  if (ctx.role === "gm" && filters.excludeSpaceId) {
    const root = filters.excludeSpaceId;
    const next: SearchFilters = { ...filters };
    delete next.excludeSpaceId;
    const slim = await db
      .select({ id: spaces.id, parentSpaceId: spaces.parentSpaceId })
      .from(spaces);
    next.excludeSpaceIds = [...collectDescendantSpaceIds(root, slim)];
    return next;
  }

  if (
    ctx.role === "gm" &&
    !isHeartgardenGmPlayerSpaceBreakGlassEnabled() &&
    !filters.spaceId &&
    !filters.excludeSpaceId &&
    !(filters.excludeSpaceIds?.length)
  ) {
    const implicitRootId = await findImplicitPlayerRootSpaceId(db);
    if (implicitRootId) {
      const next: SearchFilters = { ...filters };
      const slim = await db
        .select({ id: spaces.id, parentSpaceId: spaces.parentSpaceId })
        .from(spaces);
      next.excludeSpaceIds = [...collectDescendantSpaceIds(implicitRootId, slim)];
      return next;
    }
  }

  return filters;
}
