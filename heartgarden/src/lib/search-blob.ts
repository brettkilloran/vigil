type SearchBlobSource = {
  title?: string | null;
  contentText?: string | null;
  contentJson?: unknown;
  entityType?: string | null;
  entityMeta?: unknown;
  imageUrl?: string | null;
  imageMeta?: unknown;
  loreSummary?: string | null;
  loreAliases?: string[] | null;
};

const MAX_DEPTH = 6;

function collectScalarText(value: unknown, out: string[], depth: number): void {
  if (value == null || depth > MAX_DEPTH) return;
  if (typeof value === "string") {
    const v = value.trim();
    if (v) out.push(v);
    return;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    out.push(String(value));
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectScalarText(entry, out, depth + 1);
    }
    return;
  }
  if (typeof value === "object") {
    for (const entry of Object.values(value as Record<string, unknown>)) {
      collectScalarText(entry, out, depth + 1);
    }
  }
}

export function buildSearchBlob(source: SearchBlobSource): string {
  const out: string[] = [];
  collectScalarText(source.title, out, 0);
  collectScalarText(source.loreSummary, out, 0);
  if (Array.isArray(source.loreAliases)) {
    for (const a of source.loreAliases) collectScalarText(a, out, 0);
  }
  collectScalarText(source.contentText, out, 0);
  collectScalarText(source.contentJson, out, 0);
  collectScalarText(source.entityType, out, 0);
  collectScalarText(source.entityMeta, out, 0);
  collectScalarText(source.imageUrl, out, 0);
  collectScalarText(source.imageMeta, out, 0);
  return out.join(" ").replace(/\s+/g, " ").trim();
}
