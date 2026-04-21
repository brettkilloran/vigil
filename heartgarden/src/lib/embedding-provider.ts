/**
 * Vector chunk embeddings for pgvector / hybrid search (`item_embeddings`).
 *
 * When **`OPENAI_API_KEY`** is set, embeddings use the OpenAI Embeddings API
 * (default model **`text-embedding-3-small`**, 1536 dimensions — matches
 * `vault-retrieval` / pgvector usage). Without a key, **`isEmbeddingApiConfigured()`**
 * is false: vault reindex skips vector rows and hybrid search uses lexical fusion only.
 */

const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

export function isEmbeddingApiConfigured(): boolean {
  return Boolean((process.env.OPENAI_API_KEY ?? "").trim());
}

function embeddingModel(): string {
  return (process.env.HEARTGARDEN_OPENAI_EMBEDDING_MODEL ?? "").trim() || DEFAULT_EMBEDDING_MODEL;
}

/**
 * Embed many text chunks in as few requests as practical (OpenAI allows batch input).
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const apiKey = (process.env.OPENAI_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new Error(
      "Embeddings are not configured: set OPENAI_API_KEY for vector chunk indexing.",
    );
  }

  const model = embeddingModel();
  const out: number[][] = new Array(texts.length);

  const batchSize = 64;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: batch,
      }),
    });

    const json = (await res.json()) as {
      data?: { index?: number; embedding?: number[] }[];
      error?: { message?: string };
    };

    if (!res.ok) {
      throw new Error(
        json.error?.message ?? `OpenAI embeddings failed (${res.status})`,
      );
    }

    const data = json.data;
    if (!data?.length) {
      throw new Error("OpenAI embeddings returned no data");
    }

    for (const item of data) {
      const idx = item.index;
      const emb = item.embedding;
      if (typeof idx !== "number" || !emb?.length) continue;
      const globalIdx = i + idx;
      if (globalIdx < 0 || globalIdx >= out.length) continue;
      out[globalIdx] = emb;
    }
  }

  if (out.some((v) => !v)) {
    throw new Error("OpenAI embeddings response missing vectors for some chunks");
  }

  return out;
}
