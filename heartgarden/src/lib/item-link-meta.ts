/**
 * How a canvas edge relates to structured lore:
 * - `association`: freeform canvas connection (default)
 * - `structured_mirror`: mirrors a binding slot on the source card (hgArch)
 */
export const LINK_SEMANTICS_ASSOCIATION = "association" as const;
export const LINK_SEMANTICS_STRUCTURED_MIRROR = "structured_mirror" as const;

export type LinkSemantics =
  | typeof LINK_SEMANTICS_ASSOCIATION
  | typeof LINK_SEMANTICS_STRUCTURED_MIRROR;

/** Rope thread slack stored in `item_links.meta.slackMultiplier` (see canvas connection UI). */
export const LINK_META_SLACK_MIN = 1.0;
export const LINK_META_SLACK_MAX = 1.35;

/** Default rope slack when unset (matches new connections in `ArchitecturalCanvasApp`). */
export const DEFAULT_LINK_SLACK_MULTIPLIER = 1.1;

export function clampLinkMetaSlackMultiplier(value: number): number {
  return Math.max(LINK_META_SLACK_MIN, Math.min(LINK_META_SLACK_MAX, value));
}

/** Read slack from link `meta` JSON; returns null if missing or invalid. */
export function parseSlackMultiplierFromLinkMeta(meta: unknown): number | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return null;
  }
  const v = (meta as Record<string, unknown>).slackMultiplier;
  if (typeof v !== "number" || !Number.isFinite(v)) {
    return null;
  }
  return clampLinkMetaSlackMultiplier(v);
}

/** Hydrated graph edges and API may expose `slackMultiplier` as number or null; normalize for the canvas model. */
export function resolveSlackMultiplierForDisplay(
  value: number | null | undefined
): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clampLinkMetaSlackMultiplier(value);
  }
  return DEFAULT_LINK_SLACK_MULTIPLIER;
}

/** Normalize `meta.linkSemantics`; default association; invalid values become association. */
/**
 * Lore recall: prefer association-like edges over structured mirrors / import binding hints.
 * Lower rank = expand first (0 = association, 1 = deprioritized).
 */
export function linkExpansionDepriorityRank(meta: unknown): number {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return 0;
  }
  const m = meta as Record<string, unknown>;
  if (m.linkSemantics === LINK_SEMANTICS_STRUCTURED_MIRROR) {
    return 1;
  }
  if (m.linkIntent === "binding_hint") {
    return 1;
  }
  return 0;
}

export function normalizeLinkSemanticsInMeta(
  meta: Record<string, unknown>
): void {
  const raw = meta.linkSemantics;
  if (raw === LINK_SEMANTICS_STRUCTURED_MIRROR) {
    meta.linkSemantics = LINK_SEMANTICS_STRUCTURED_MIRROR;
    return;
  }
  if (raw === LINK_SEMANTICS_ASSOCIATION || raw === undefined || raw === null) {
    meta.linkSemantics = LINK_SEMANTICS_ASSOCIATION;
    return;
  }
  meta.linkSemantics = LINK_SEMANTICS_ASSOCIATION;
}
