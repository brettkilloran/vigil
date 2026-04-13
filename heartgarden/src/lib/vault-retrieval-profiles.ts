import type { HybridRetrieveOptions } from "@/src/lib/vault-retrieval";

/** Default lexical + vector chunk breadth for GET /api/search (maxItems comes from query `limit`). */
export const API_SEARCH_HYBRID_OPTIONS: HybridRetrieveOptions = {
  ftsLimit: 36,
  fuzzyLimitWhenEmpty: 20,
  fuzzyLimitWhenSparse: 16,
  ftsSparseThreshold: 8,
  vectorChunkLimit: 56,
  maxChunksPerItem: 4,
};

/** Ask lore: wider lexical pool; maxItems set in lore-engine from request cap. */
export const LORE_HYBRID_OPTIONS: HybridRetrieveOptions = {
  ftsLimit: 72,
  fuzzyLimitWhenEmpty: 24,
  fuzzyLimitWhenSparse: 20,
  ftsSparseThreshold: 8,
  vectorChunkLimit: 80,
  maxChunksPerItem: 4,
};

/** Lore import merge candidates: conservative recall per note. */
export const IMPORT_MERGE_HYBRID_OPTIONS: HybridRetrieveOptions = {
  ftsLimit: 36,
  fuzzyLimitWhenEmpty: 20,
  fuzzyLimitWhenSparse: 16,
  ftsSparseThreshold: 8,
  maxItems: 8,
  vectorChunkLimit: 56,
  maxChunksPerItem: 4,
};

/** Consistency checker: moderate breadth. */
export const LORE_CONSISTENCY_HYBRID_OPTIONS: HybridRetrieveOptions = {
  ftsLimit: 48,
  fuzzyLimitWhenEmpty: 22,
  fuzzyLimitWhenSparse: 18,
  ftsSparseThreshold: 8,
  maxItems: 12,
  vectorChunkLimit: 64,
  maxChunksPerItem: 4,
};
