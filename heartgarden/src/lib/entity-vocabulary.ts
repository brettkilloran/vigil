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

export interface EntityVocabularyEntry {
  itemIds: string[];
  originalTerm: string;
  term: string;
}

export interface EntityVocabularyPayload {
  etag: string;
  itemTitles: Record<string, string>;
  terms: EntityVocabularyEntry[];
}

interface CacheEntry {
  expiresAt: number;
  payload: EntityVocabularyPayload;
}

const vocabularyCache = new Map<string, CacheEntry>();

function normalizeTerm(term: string): string {
  return term.trim().toLowerCase();
}

function candidateTermsFromRaw(raw: string): string[] {
  const trimmed = raw.trim();
  if (trimmed.length < MIN_TERM_LEN) {
    return [];
  }
  const out = new Set<string>();
  out.add(trimmed);
  for (const token of trimmed.split(/\s+/)) {
    const normalized = token.replace(/[^a-zA-Z0-9_-]/g, "").trim();
    if (normalized.length < MIN_TERM_LEN) {
      continue;
    }
    if (STOPWORDS.has(normalized.toLowerCase())) {
      continue;
    }
    out.add(normalized);
  }
  return [...out];
}

export async function buildEntityVocabularyForBrane(
  db: VigilDb,
  braneId: string
): Promise<EntityVocabularyPayload> {
  const now = Date.now();
  const cached = vocabularyCache.get(braneId);
  if (cached && cached.expiresAt > now) {
    return cached.payload;
  }

  const spaceRows = await db
    .select({ id: spaces.id })
    .from(spaces)
    .where(eq(spaces.braneId, braneId));
  const spaceIds = spaceRows.map((row) => row.id);
  if (spaceIds.length === 0) {
    const empty: EntityVocabularyPayload = {
      etag: "v0",
      itemTitles: {},
      terms: [],
    };
    vocabularyCache.set(braneId, {
      expiresAt: now + CACHE_TTL_MS,
      payload: empty,
    });
    return empty;
  }

  const rows = await db
    .select({
      id: items.id,
      loreAliases: items.loreAliases,
      title: items.title,
    })
    .from(items)
    .where(inArray(items.spaceId, spaceIds));

  const itemTitles: Record<string, string> = {};
  const byTerm = new Map<
    string,
    { itemIds: Set<string>; originalTerm: string }
  >();
  for (const row of rows) {
    itemTitles[row.id] = row.title;
    const aliases = Array.isArray(row.loreAliases)
      ? row.loreAliases.filter((v): v is string => typeof v === "string")
      : [];
    const seeds = [row.title, ...aliases];
    for (const seed of seeds) {
      for (const candidate of candidateTermsFromRaw(seed)) {
        const normalized = normalizeTerm(candidate);
        if (normalized.length < MIN_TERM_LEN || STOPWORDS.has(normalized)) {
          continue;
        }
        const slot = byTerm.get(normalized) ?? {
          itemIds: new Set<string>(),
          originalTerm: candidate,
        };
        slot.itemIds.add(row.id);
        byTerm.set(normalized, slot);
      }
    }
  }

  const terms: EntityVocabularyEntry[] = [...byTerm.entries()]
    .map(([term, payload]) => ({
      itemIds: [...payload.itemIds].sort(),
      originalTerm: payload.originalTerm,
      term,
    }))
    .sort((a, b) => a.term.localeCompare(b.term));

  const digest = createHash("sha256")
    .update(
      JSON.stringify(
        terms.map((entry) => ({ ids: entry.itemIds, term: entry.term }))
      )
    )
    .digest("hex")
    .slice(0, 24);
  const nextPayload: EntityVocabularyPayload = {
    etag: `v1-${digest}`,
    itemTitles,
    terms,
  };
  vocabularyCache.set(braneId, {
    expiresAt: now + CACHE_TTL_MS,
    payload: nextPayload,
  });
  return nextPayload;
}

export function clearEntityVocabularyCache(braneId?: string): void {
  if (braneId) {
    vocabularyCache.delete(braneId);
    return;
  }
  vocabularyCache.clear();
}

/**
 * Derive the normalized vocabulary terms a title/alias seed would contribute
 * to {@link buildEntityVocabularyForBrane}. Used by mention rescan paths to
 * scope work to only the terms whose membership actually changed (e.g. the
 * old + new title on a rename).
 *
 * REVIEW_2026-04-25_1730 H3: keeps incremental rescans aligned with the same
 * tokenization the vocabulary builder uses, so we never miss or invent terms.
 */
export function deriveVocabularyTermsFromSeed(
  seed: string | null | undefined
): string[] {
  if (!seed) {
    return [];
  }
  const out = new Set<string>();
  for (const candidate of candidateTermsFromRaw(seed)) {
    const normalized = normalizeTerm(candidate);
    if (normalized.length < MIN_TERM_LEN || STOPWORDS.has(normalized)) {
      continue;
    }
    out.add(normalized);
  }
  return [...out];
}
