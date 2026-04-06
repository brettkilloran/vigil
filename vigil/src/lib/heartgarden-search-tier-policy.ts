import {
  heartgardenPlayerSpaceIdExcludedFromGm,
  type HeartgardenApiBootContext,
} from "@/src/lib/heartgarden-api-boot-context";
import { isHeartgardenGmPlayerSpaceBreakGlassEnabled } from "@/src/lib/heartgarden-gm-break-glass";
import type { SearchFilters } from "@/src/lib/spaces";

export type SearchTierPolicyResult =
  | { ok: false }
  | { ok: true; filters: SearchFilters; mode: string };

/**
 * Centralizes `/api/search` tier rules: Players pin space + fts-only; GM global search excludes Players space.
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
    if (nextFilters.spaceId && nextFilters.spaceId !== ctx.playerSpaceId) {
      return { ok: false };
    }
    nextFilters.spaceId = ctx.playerSpaceId;
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
    const nextFilters = { ...filters };
    if (nextFilters.spaceId && nextFilters.spaceId !== ctx.playerSpaceId) {
      return { ok: false };
    }
    nextFilters.spaceId = ctx.playerSpaceId;
    return { ok: true, filters: nextFilters, mode: "" };
  }

  if (ctx.role === "gm" && hid && !filters.spaceId && !isHeartgardenGmPlayerSpaceBreakGlassEnabled()) {
    return { ok: true, filters: { ...filters, excludeSpaceId: hid }, mode: "" };
  }

  return { ok: true, filters: { ...filters }, mode: "" };
}
