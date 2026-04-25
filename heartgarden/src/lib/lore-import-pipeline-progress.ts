/**
 * Single coarse progress value (0–99 while running; callers may send 100 when truly done).
 * Keeps the import-planning UI determinate even when a phase has no natural step/total
 * (e.g. one long outline LLM call).
 */
const PIPELINE_ORDER = [
  "chunking",
  "outline",
  "vault_retrieval",
  "merge",
  "clarify",
  "finalize",
  "persist_review",
] as const;

const PIPELINE_WEIGHT: Record<string, number> = {
  chunking: 5,
  outline: 33,
  vault_retrieval: 19,
  merge: 22,
  clarify: 13,
  finalize: 3,
  persist_review: 5,
};

const PIPELINE_SUM = PIPELINE_ORDER.reduce((a, k) => a + PIPELINE_WEIGHT[k], 0);

export interface LoreImportPipelineFractionOpts {
  /** 0–1 position inside the current phase when there is no step/total. */
  phaseFraction?: number;
  step?: number;
  total?: number;
}

export function computeLoreImportPipelinePercent(
  phase: string,
  opts?: LoreImportPipelineFractionOpts
): number | null {
  const p = String(phase || "")
    .trim()
    .toLowerCase();
  if (p === "queued") {
    return 1;
  }
  if (p === "fallback_plan") {
    return 5;
  }
  if (p === "failed") {
    return 99;
  }
  if (p === "ready") {
    return 99;
  }

  const idx = PIPELINE_ORDER.indexOf(p as (typeof PIPELINE_ORDER)[number]);
  if (idx === -1) {
    return null;
  }

  let before = 0;
  for (let i = 0; i < idx; i++) {
    before += PIPELINE_WEIGHT[PIPELINE_ORDER[i]] ?? 0;
  }
  const w = PIPELINE_WEIGHT[p] ?? 6;

  let frac = opts?.phaseFraction;
  if (
    frac === undefined &&
    typeof opts?.step === "number" &&
    typeof opts?.total === "number" &&
    opts.total > 0
  ) {
    frac = Math.max(0, Math.min(1, (opts.step - 0.5) / opts.total));
  }
  if (frac === undefined) {
    frac = 0.45;
  }
  frac = Math.max(0, Math.min(1, frac));

  const raw = ((before + frac * w) / PIPELINE_SUM) * 100;
  return Math.max(0, Math.min(99, Math.round(raw)));
}
