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
 * Retry / backoff knobs for the OpenAI Embeddings API. Mirrors `anthropic-client.ts`
 * so transient 429/5xx and connection errors no longer fail the whole reindex.
 * (`REVIEW_2026-04-25_1835` H9.)
 */
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRYABLE_NETWORK_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "ENOTFOUND",
]);

function maxEmbeddingRetries(): number {
  const raw = (process.env.HEARTGARDEN_OPENAI_EMBEDDINGS_MAX_RETRIES ?? "").trim();
  if (!raw) return 3;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 3;
  return Math.min(8, Math.max(0, Math.floor(parsed)));
}

function isRetryableNetworkError(err: unknown): boolean {
  if (err instanceof Error) {
    const code = String((err as { code?: unknown }).code ?? "").toUpperCase();
    if (RETRYABLE_NETWORK_CODES.has(code)) return true;
    // Some Node fetch errors bury the code on `cause`.
    const cause = (err as { cause?: { code?: unknown } }).cause;
    if (cause) {
      const causeCode = String(cause.code ?? "").toUpperCase();
      if (RETRYABLE_NETWORK_CODES.has(causeCode)) return true;
    }
  }
  return false;
}

function jitteredBackoffMs(retryAttempt: number): number {
  // 1s, 2s, 4s, 8s … with up to ±25% jitter. Capped at 16s.
  const base = Math.min(16_000, 1000 * 2 ** Math.max(0, retryAttempt - 1));
  const jitter = base * 0.25 * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(base + jitter));
}

async function embedBatchWithRetry(
  apiKey: string,
  model: string,
  batch: string[],
): Promise<{ data?: { index?: number; embedding?: number[] }[] }> {
  const maxRetries = maxEmbeddingRetries();
  let attempt = 0;
  for (;;) {
    let res: Response;
    try {
      res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model, input: batch }),
      });
    } catch (err) {
      if (attempt < maxRetries && isRetryableNetworkError(err)) {
        attempt += 1;
        await new Promise((r) => setTimeout(r, jitteredBackoffMs(attempt)));
        continue;
      }
      throw err;
    }

    const json = (await res.json().catch(() => ({}))) as {
      data?: { index?: number; embedding?: number[] }[];
      error?: { message?: string };
    };

    if (res.ok) {
      const data = json.data;
      if (!data?.length) throw new Error("OpenAI embeddings returned no data");
      return { data };
    }

    if (attempt < maxRetries && RETRYABLE_STATUS.has(res.status)) {
      attempt += 1;
      await new Promise((r) => setTimeout(r, jitteredBackoffMs(attempt)));
      continue;
    }

    throw new Error(
      json.error?.message ?? `OpenAI embeddings failed (${res.status})`,
    );
  }
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
    const { data } = await embedBatchWithRetry(apiKey, model, batch);
    if (!data) throw new Error("OpenAI embeddings returned no data");

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
