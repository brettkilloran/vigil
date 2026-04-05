/** Matches `isPlayerLayer` create paths: note, sticky, checklist — not folder/image/webclip. */
const PLAYERS_ALLOWED_ITEM_TYPES = new Set(["note", "sticky", "checklist"]);

const GM_ONLY_ENTITY_META_KEYS = new Set([
  "loreReviewTags",
  "loreHistorical",
  "loreReviewStatus",
  "campaignEpoch",
]);

export function playersMayCreateItemType(itemType: string): boolean {
  return PLAYERS_ALLOWED_ITEM_TYPES.has(itemType);
}

export function playersMayPatchItemType(nextType: string | undefined): boolean {
  if (nextType === undefined) return true;
  return PLAYERS_ALLOWED_ITEM_TYPES.has(nextType);
}

export function stripGmOnlyEntityMetaPatch(
  patch: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!patch || typeof patch !== "object") return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (GM_ONLY_ENTITY_META_KEYS.has(k)) continue;
    out[k] = v;
  }
  return out;
}

export function playersPatchBodyViolatesPolicy(body: {
  itemType?: string;
  imageUrl?: string | null;
  imageMeta?: Record<string, unknown> | null;
  entityMeta?: Record<string, unknown> | null;
  entityMetaMerge?: Record<string, unknown>;
}): boolean {
  if (!playersMayPatchItemType(body.itemType)) return true;
  if (body.imageUrl !== undefined && body.imageUrl !== null) return true;
  if (body.imageMeta !== undefined && body.imageMeta !== null) return true;
  if (body.entityMeta !== undefined && body.entityMeta !== null) {
    for (const k of Object.keys(body.entityMeta)) {
      if (GM_ONLY_ENTITY_META_KEYS.has(k)) return true;
    }
  }
  if (body.entityMetaMerge && typeof body.entityMetaMerge === "object") {
    for (const k of Object.keys(body.entityMetaMerge)) {
      if (GM_ONLY_ENTITY_META_KEYS.has(k)) return true;
    }
  }
  return false;
}
