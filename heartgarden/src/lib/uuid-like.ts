/** Inner pattern (no anchors, no flags) — composable into larger regexes. */
export const UUID_INNER_PATTERN =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** Match `vigil:item:<uuid>` anywhere in a string (global, case-insensitive). */
export const VIGIL_ITEM_LINK_RE = new RegExp(
  `vigil:item:(${UUID_INNER_PATTERN})`,
  "gi"
);

/** Match `[[label]](vigil:item:<uuid>)` wiki-link form (global, case-insensitive). */
export const WIKI_VIGIL_ITEM_LINK_RE = new RegExp(
  `\\[\\[([^\\[\\]]+)\\]\\]\\s*\\(vigil:item:(${UUID_INNER_PATTERN})\\)`,
  "gi"
);

const UUID_LIKE_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** UUID v4 shape check shared by canvas, hgArch extractors, and API validation. */
export function isUuidLike(value: string | null | undefined): value is string {
  if (!value) {
    return false;
  }
  return UUID_LIKE_RE.test(value);
}

/** Looser UUID v1-5 shape check (used by space id parsing where legacy ids may be v1). */
const UUID_V1_TO_5_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidV1To5Like(
  value: string | null | undefined
): value is string {
  if (!value) {
    return false;
  }
  return UUID_V1_TO_5_RE.test(value);
}
