const DEFAULT_MODEL = "text-embedding-3-small";
const OPENAI_URL = "https://api.openai.com/v1/embeddings";

export function isEmbeddingApiConfigured(): boolean {
  return Boolean((process.env.OPENAI_API_KEY ?? "").trim());
}

export function getEmbeddingModel(): string {
  return (process.env.HEARTGARDEN_EMBEDDING_MODEL ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL;
}

/**
 * Returns 1536-dimensional vectors (matches `vector(1536)` in schema).
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const key = (process.env.OPENAI_API_KEY ?? "").trim();
  if (!key) throw new Error("OPENAI_API_KEY not set");
  const model = getEmbeddingModel();
  if (texts.length === 0) return [];

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      input: texts,
      dimensions: 1536,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenAI embeddings failed: ${res.status} ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    data?: { embedding: number[]; index: number }[];
  };
  const rows = Array.isArray(data.data) ? data.data : [];
  rows.sort((a, b) => a.index - b.index);
  const out = rows.map((r) => r.embedding);
  if (out.length !== texts.length) {
    throw new Error("OpenAI embeddings: unexpected response length");
  }
  for (const emb of out) {
    if (!Array.isArray(emb) || emb.length !== 1536) {
      throw new Error(`OpenAI embeddings: expected dim 1536, got ${emb?.length}`);
    }
  }
  return out;
}
