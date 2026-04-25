/**
 * Server-side (Next.js route handlers): best-effort Redis publish timing.
 * Resets per serverless instance; use for logs / relative comparison, not global SLO.
 */

type PublishSample = { ms: number; at: number };

const recent: PublishSample[] = [];
const MAX_SAMPLES = 50;

export function recordHeartgardenRealtimePublishMs(ms: number): void {
  if (!Number.isFinite(ms) || ms < 0) {
    return;
  }
  recent.push({ ms, at: Date.now() });
  while (recent.length > MAX_SAMPLES) {
    recent.shift();
  }
  if (
    process.env.NODE_ENV === "development" ||
    process.env.HEARTGARDEN_REALTIME_DEBUG === "1"
  ) {
    console.debug(`[heartgarden realtime publish] ${ms.toFixed(1)}ms`);
  }
}

export function getHeartgardenRealtimePublishMetricsSnapshot(): {
  count: number;
  lastMs: number | null;
  p50Ms: number | null;
  p95Ms: number | null;
} {
  if (recent.length === 0) {
    return { count: 0, lastMs: null, p50Ms: null, p95Ms: null };
  }
  const sorted = [...recent.map((r) => r.ms)].sort((a, b) => a - b);
  const lastMs = recent[recent.length - 1]!.ms;
  const p = (q: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))] ??
    null;
  return {
    count: recent.length,
    lastMs,
    p50Ms: p(0.5),
    p95Ms: p(0.95),
  };
}
