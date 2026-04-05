/** Rope thread slack stored in `item_links.meta.slackMultiplier` (see canvas connection UI). */
export const LINK_META_SLACK_MIN = 1.0;
export const LINK_META_SLACK_MAX = 1.35;

export function clampLinkMetaSlackMultiplier(value: number): number {
  return Math.max(LINK_META_SLACK_MIN, Math.min(LINK_META_SLACK_MAX, value));
}

/** Read slack from link `meta` JSON; returns null if missing or invalid. */
export function parseSlackMultiplierFromLinkMeta(meta: unknown): number | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const v = (meta as Record<string, unknown>).slackMultiplier;
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return clampLinkMetaSlackMultiplier(v);
}
