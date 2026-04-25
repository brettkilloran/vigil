import { createHash } from "node:crypto";

import { eq, inArray } from "drizzle-orm";

import type { tryGetDb } from "@/src/db/index";
import { items, spaces } from "@/src/db/schema";

type VigilDb = NonNullable<ReturnType<typeof tryGetDb>>;

const MIN_TERM_LEN = 3;
const CACHE_TTL_MS = 15_000;
const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "into",
  "that",
  "this",
  "have",
  "has",
  "had",
  "are",
  "was",
  "were",
  "you",
  "your",
  "our",
  "their",
  "they",
  "them",
  "but",
  "not",
  "out",
  "all",
  "any",
  "can",
  "will",
  "just",
]);

export type EntityVocabularyEntry = {
  term: string;
  itemIds: string[];
  originalTerm: string;
};

export type EntityVocabularyPayload = {
  etag: string;
  terms: EntityVocabularyEntry[];
  itemTitles: Record<string, string>;
};

type CacheEntry = {
  expiresAt: number;
  payload: EntityVocabularyPayload;
};

const vocabularyCache = new Map<string, CacheEntry>();

function normalizeTerm(term: string): string {
  return term.trim().toLowerCase();
}

function candidateTermsFromRaw(raw: string): string[] {
  const trimmed = raw.trim();
  if (trimmed.length < MIN_TERM_LEN) return [];
  const out = new Set<string>();
  out.add(trimmed);
  for (const token of trimmed.split(/\s+/)) {
    const normalized = token.replace(/[^a-zA-Z0-9_-]/g, "").trim();
    if (normalized.length < MIN_TERM_LEN) continue;
    if (STOPWORDS.has(normalized.toLowerCase())) continue;
    out.add(normalized);
  }
  return [...out];
}

export async function buildEntityVocabularyForBrane(
  db: VigilDb,
  braneId: string,
): Promise<EntityVocabularyPayload> {
  const now = Date.now();
  const cached = vocabularyCache.get(braneId);
  if (cached && cached.expiresAt > now) return cached.payload;

  const spaceRows = await db
    .select({ id: spaces.id })
    .from(spaces)
    .where(eq(spaces.braneId, braneId));
  const spaceIds = spaceRows.map((row) => row.id);
  if (spaceIds.length === 0) {
    const empty: EntityVocabularyPayload = { etag: "v0", terms: [], itemTitles: {} };
    vocabularyCache.set(braneId, { expiresAt: now + CACHE_TTL_MS, payload: empty });
    return empty;
  }

  const rows = await db
    .select({
      id: items.id,
      title: items.title,
      loreAliases: items.loreAliases,
    })
    .from(items)
    .where(inArray(items.spaceId, spaceIds));

  const itemTitles: Record<string, string> = {};
  const byTerm = new Map<string, { itemIds: Set<string>; originalTerm: string }>();
  for (const row of rows) {
    itemTitles[row.id] = row.title;
    const aliases = Array.isArray(row.loreAliases) ? row.loreAliases.filter((v): v is string => typeof v === "string") : [];
    const seeds = [row.title, ...aliases];
    for (const seed of seeds) {
      for (const candidate of candidateTermsFromRaw(seed)) {
        const normalized = normalizeTerm(candidate);
        if (normalized.length < MIN_TERM_LEN || STOPWORDS.has(normalized)) continue;
        const slot = byTerm.get(normalized) ?? { itemIds: new Set<string>(), originalTerm: candidate };
        slot.itemIds.add(row.id);
        byTerm.set(normalized, slot);
      }
    }
  }

  const terms: EntityVocabularyEntry[] = [...byTerm.entries()]
    .map(([term, payload]) => ({
      term,
      itemIds: [...payload.itemIds].sort(),
      originalTerm: payload.originalTerm,
    }))
    .sort((a, b) => a.term.localeCompare(b.term));

  const digest = createHash("sha256")
    .update(
      JSON.stringify(
        terms.map((entry) => ({ term: entry.term, ids: entry.itemIds })),
      ),
    )
    .digest("hex")
    .slice(0, 24);
  const nextPayload: EntityVocabularyPayload = { etag: `v1-${digest}`, terms, itemTitles };
  vocabularyCache.set(braneId, { expiresAt: now + CACHE_TTL_MS, payload: nextPayload });
  return nextPayload;
}

export function clearEntityVocabularyCache(braneId?: string): void {
  if (braneId) {
    vocabularyCache.delete(braneId);
    return;
  }
  vocabularyCache.clear();
}
