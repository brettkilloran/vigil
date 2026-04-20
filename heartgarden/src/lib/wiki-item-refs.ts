/** Match `vigil:item:<uuid>` mentions in note bodies (HTML or plain text). */
const VIGIL_ITEM_RE =
  /vigil:item:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;

/**
 * Extract unique item ids from prose/wiki-style references. Case-insensitive on hex.
 */
export function extractVigilItemIdsFromText(text: string | null | undefined): string[] {
  if (!text || !text.trim()) return [];
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(VIGIL_ITEM_RE.source, "gi");
  while ((m = re.exec(text)) !== null) {
    out.add(m[1]!.toLowerCase());
  }
  return [...out];
}
