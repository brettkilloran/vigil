/**
 * Single source of truth for “everything on this item that should be findable”:
 * FTS (`search_blob`), vault embeddings, and lore excerpt fallbacks.
 *
 * Walks `content_json` with TipTap hgDoc + HTML awareness; strips HTML-like strings;
 * includes `entity_meta` and image fields.
 */
import { stripLegacyHtmlToPlainText } from "@/src/lib/hg-doc/html-to-doc";
import {
  hgDocToPlainText,
  isHgDocContentJson,
  readHgDocFromContentJson,
} from "@/src/lib/hg-doc/serialize";

export interface ItemSearchableSource {
  contentJson?: unknown;
  contentText?: string | null;
  entityMeta?: unknown;
  entityType?: string | null;
  imageMeta?: unknown;
  imageUrl?: string | null;
  loreAliases?: string[] | null;
  loreSummary?: string | null;
  title?: string | null;
}

/** Narrow row shape for callers that have a full `items` row. */
export type ItemSearchableRowPick = Pick<
  ItemSearchableSource,
  | "title"
  | "contentText"
  | "contentJson"
  | "entityType"
  | "entityMeta"
  | "imageUrl"
  | "imageMeta"
  | "loreSummary"
  | "loreAliases"
>;

export function itemSearchableSourceFromRow(
  row: ItemSearchableRowPick
): ItemSearchableSource {
  return {
    contentJson: row.contentJson,
    contentText: row.contentText,
    entityMeta: row.entityMeta,
    entityType: row.entityType,
    imageMeta: row.imageMeta,
    imageUrl: row.imageUrl,
    loreAliases: row.loreAliases ?? undefined,
    loreSummary: row.loreSummary,
    title: row.title,
  };
}

const MAX_DEPTH = 48;
/** Soft cap per string segment (pathological cards / abuse). */
const MAX_SEGMENT_CHARS = 600_000;

const HTML_TAG_LIKE_RE = /<[a-z][\s\S]*>/i;
const CANONICAL_KIND_SLUG_RE = /^[a-z][a-z0-9_-]*$/;

function pushSegment(raw: string, parts: string[]): void {
  let s = raw.replace(/\s+/g, " ").trim();
  if (!s) {
    return;
  }
  if (s.length > MAX_SEGMENT_CHARS) {
    s = `${s.slice(0, MAX_SEGMENT_CHARS)} …`;
  }
  parts.push(s);
}

function looksLikeHtmlFragment(s: string): boolean {
  return (
    s.length >= 8 &&
    s.includes("<") &&
    s.includes(">") &&
    HTML_TAG_LIKE_RE.test(s)
  );
}

function normalizeMaybeHtmlString(s: string): string {
  if (!looksLikeHtmlFragment(s)) {
    return s;
  }
  return stripLegacyHtmlToPlainText(s);
}

function appendString(s: string, parts: string[]): void {
  pushSegment(normalizeMaybeHtmlString(s), parts);
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: vault corpus walker recurses unknown JSON shapes (TipTap doc, hgArch, entity_meta) with depth + cycle guards
function appendFromUnknown(
  value: unknown,
  parts: string[],
  depth: number,
  seen: Set<object>
): void {
  if (value == null || depth > MAX_DEPTH) {
    return;
  }
  if (typeof value === "string") {
    appendString(value, parts);
    return;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    pushSegment(String(value), parts);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) {
      appendFromUnknown(v, parts, depth + 1, seen);
    }
    return;
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (seen.has(o)) {
      return;
    }
    seen.add(o);
    try {
      if (isHgDocContentJson(o)) {
        pushSegment(hgDocToPlainText(readHgDocFromContentJson(o)), parts);
        for (const [k, v] of Object.entries(o)) {
          if (k === "doc" || k === "format") {
            continue;
          }
          appendFromUnknown(v, parts, depth + 1, seen);
        }
        return;
      }
      if (o.format === "html" && typeof o.html === "string") {
        pushSegment(stripLegacyHtmlToPlainText(o.html), parts);
        for (const [k, v] of Object.entries(o)) {
          if (k === "html" || k === "format") {
            continue;
          }
          appendFromUnknown(v, parts, depth + 1, seen);
        }
        return;
      }
      for (const v of Object.values(o)) {
        appendFromUnknown(v, parts, depth + 1, seen);
      }
    } finally {
      seen.delete(o);
    }
  }
}

/**
 * If `entity_meta.canonicalEntityKind` is a short slug, emit a discoverable
 * `kind:<slug>` token so FTS and vector retrieval can filter by lore kind.
 */
function extractCanonicalEntityKindToken(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") {
    return null;
  }
  const raw = (meta as Record<string, unknown>).canonicalEntityKind;
  if (typeof raw !== "string") {
    return null;
  }
  const slug = raw.trim().toLowerCase();
  if (!slug || slug.length > 32) {
    return null;
  }
  if (!CANONICAL_KIND_SLUG_RE.test(slug)) {
    return null;
  }
  return `kind:${slug}`;
}

/**
 * Plain-text corpus for search indexing and embeddings (space-normalized).
 */
export function buildItemVaultCorpus(source: ItemSearchableSource): string {
  const parts: string[] = [];
  const seen = new Set<object>();

  appendString(String(source.title ?? ""), parts);
  if (source.entityType) {
    appendString(String(source.entityType), parts);
  }
  const canonicalKindToken = extractCanonicalEntityKindToken(source.entityMeta);
  if (canonicalKindToken) {
    appendString(canonicalKindToken, parts);
  }
  if (source.loreSummary) {
    appendString(String(source.loreSummary), parts);
  }
  if (Array.isArray(source.loreAliases)) {
    for (const a of source.loreAliases) {
      appendFromUnknown(a, parts, 0, seen);
    }
  }
  appendString(String(source.contentText ?? ""), parts);
  appendFromUnknown(source.contentJson, parts, 0, seen);
  appendFromUnknown(source.entityMeta, parts, 0, seen);
  if (source.imageUrl) {
    appendString(String(source.imageUrl), parts);
  }
  appendFromUnknown(source.imageMeta, parts, 0, seen);

  return parts.join(" ").replace(/\s+/g, " ").trim();
}
