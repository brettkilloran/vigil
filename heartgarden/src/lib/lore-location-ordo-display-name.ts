/** Empty title line from `splitOrdoV7DisplayName` when there are no words — not persisted as a real place name. */
export const ORDO_V7_EMPTY_NAME_SENTINEL = "UNTITLED";

const WHITESPACE_SPLIT_RE = /\s+/;

/** Split place name for ORDO slab title (two-line ALL CAPS when multi-word). */
export function splitOrdoV7DisplayName(name: string): {
  line1: string;
  line2: string | null;
} {
  const t = name.trim();
  if (!t) {
    return { line1: ORDO_V7_EMPTY_NAME_SENTINEL, line2: null };
  }
  const words = t.split(WHITESPACE_SPLIT_RE);
  if (words.length === 1) {
    return { line1: words[0].toUpperCase(), line2: null };
  }
  /* Prefer slightly more on line 2 for odd word counts (e.g. “Old Harbor” / “Kiln No. 4” vs “No. 4” alone). */
  const mid = Math.max(1, Math.floor(words.length / 2));
  return {
    line1: words.slice(0, mid).join(" ").toUpperCase(),
    line2: words.slice(mid).join(" ").toUpperCase(),
  };
}
