/**
 * Deep sort object keys for stable JSON comparison (PATCH `contentJson` dirty detection).
 * Arrays preserve order; nested objects get sorted keys recursively.
 */
function sortDeep(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortDeep);
  const o = value as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = sortDeep(o[k]);
  return out;
}

export function jsonValuesEqualForPatch(a: unknown, b: unknown): boolean {
  return JSON.stringify(sortDeep(a ?? null)) === JSON.stringify(sortDeep(b ?? null));
}
