/**
 * Vector chunk embeddings for pgvector / hybrid search (`item_embeddings`).
 *
 * This app does **not** call any external embedding API. Anthropic does not provide
 * a general-purpose text-embedding endpoint; hybrid search therefore uses **lexical
 * (FTS + fuzzy) fusion only** until a future embedding provider is wired here.
 *
 * `isEmbeddingApiConfigured()` stays false so vault reindex skips vector rows and
 * retrieval never calls `embedTexts`.
 */
export function isEmbeddingApiConfigured(): boolean {
  return false;
}

/**
 * Reserved for a future embedding provider. Not used while `isEmbeddingApiConfigured()` is false.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  throw new Error(
    "Embeddings are not configured: vector chunk indexing is disabled in this build.",
  );
}
