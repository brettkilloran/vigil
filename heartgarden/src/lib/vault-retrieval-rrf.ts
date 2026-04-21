/** Reciprocal rank fusion constant (standard default). */
export const RRF_K = 60;
export const RRF_WEIGHT_LEXICAL = 1;
export const RRF_WEIGHT_VECTOR = 1;

export type RrfFusionConfig = {
  k?: number;
  lexicalWeight?: number;
  vectorWeight?: number;
};

function normalizeRrfConfig(config: RrfFusionConfig | undefined): {
  k: number;
  lexicalWeight: number;
  vectorWeight: number;
} {
  const kRaw = config?.k;
  const lexicalWeightRaw = config?.lexicalWeight;
  const vectorWeightRaw = config?.vectorWeight;
  const k = Number.isFinite(kRaw) ? Math.max(1, Math.floor(kRaw as number)) : RRF_K;
  const lexicalWeight =
    Number.isFinite(lexicalWeightRaw) && (lexicalWeightRaw as number) > 0
      ? (lexicalWeightRaw as number)
      : RRF_WEIGHT_LEXICAL;
  const vectorWeight =
    Number.isFinite(vectorWeightRaw) && (vectorWeightRaw as number) > 0
      ? (vectorWeightRaw as number)
      : RRF_WEIGHT_VECTOR;
  return { k, lexicalWeight, vectorWeight };
}

export function rrfScore(rank: number | undefined, k = RRF_K): number {
  if (rank === undefined) return 0;
  return 1 / (k + rank + 1);
}

export type RrfFusionInput = {
  /** Item ids in lexical relevance order (first = best). */
  lexicalOrderedIds: string[];
  /** Item ids in vector relevance order (first chunk per item defines rank). */
  vectorOrderedIds: string[];
  maxItems: number;
  config?: RrfFusionConfig;
};

export type RrfFusionScore = {
  lexRank?: number;
  vecRank?: number;
  rrf: number;
};

export type RrfFusionResult = {
  topIds: string[];
  scores: Map<string, RrfFusionScore>;
};

/**
 * Pure RRF over two ordered id lists (deduped per list by first occurrence).
 */
export function fuseRrfFromOrderedLists(input: RrfFusionInput): RrfFusionResult {
  const config = normalizeRrfConfig(input.config);
  const lexRankByItem = new Map<string, number>();
  input.lexicalOrderedIds.forEach((id, i) => {
    if (!lexRankByItem.has(id)) lexRankByItem.set(id, i);
  });
  const vecRankByItem = new Map<string, number>();
  input.vectorOrderedIds.forEach((id, i) => {
    if (!vecRankByItem.has(id)) vecRankByItem.set(id, i);
  });

  const allIds = new Set<string>([...input.lexicalOrderedIds, ...input.vectorOrderedIds]);
  const scored = [...allIds].map((id) => {
    const lexR = lexRankByItem.get(id);
    const vecR = vecRankByItem.get(id);
    const rrf =
      rrfScore(lexR, config.k) * config.lexicalWeight +
      rrfScore(vecR, config.k) * config.vectorWeight;
    return { id, rrf, lexR, vecR };
  });
  scored.sort((a, b) => b.rrf - a.rrf);

  const topIds = scored.slice(0, input.maxItems).map((s) => s.id);
  const scores = new Map<string, RrfFusionScore>();
  for (const s of scored) {
    scores.set(s.id, {
      lexRank: s.lexR,
      vecRank: s.vecR,
      rrf: s.rrf,
    });
  }
  return { topIds, scores };
}
