/**
 * Client-side collab sync observability (per tab). No PII; safe for devtools.
 * Used to compare poll-interval runs vs realtime invalidation nudges.
 */

export type HeartgardenSpaceSyncRunSource =
  | "poll_interval"
  | "realtime_invalidate"
  | "initial"
  | "visibility";

type Snapshot = {
  spaceSyncRuns: Record<HeartgardenSpaceSyncRunSource, number>;
  realtimeWsConnects: number;
  realtimeWsDisconnects: number;
  realtimeMessagesReceived: number;
  pollContractFailures: number;
  bootstrapRepairAttempts: number;
};

const spaceSyncRuns: Record<HeartgardenSpaceSyncRunSource, number> = {
  poll_interval: 0,
  realtime_invalidate: 0,
  initial: 0,
  visibility: 0,
};

let realtimeWsConnects = 0;
let realtimeWsDisconnects = 0;
let realtimeMessagesReceived = 0;
let pollContractFailures = 0;
let bootstrapRepairAttempts = 0;

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function subscribeHeartgardenCollabMetrics(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function recordHeartgardenSpaceSyncRun(source: HeartgardenSpaceSyncRunSource): void {
  spaceSyncRuns[source] += 1;
  emit();
}

export function recordRealtimeWsConnect(): void {
  realtimeWsConnects += 1;
  emit();
}

export function recordRealtimeWsDisconnect(): void {
  realtimeWsDisconnects += 1;
  emit();
}

export function recordRealtimeMessageReceived(): void {
  realtimeMessagesReceived += 1;
  emit();
}

export function recordPollContractFailure(): void {
  pollContractFailures += 1;
  emit();
}

export function recordBootstrapRepairAttempt(): void {
  bootstrapRepairAttempts += 1;
  emit();
}

export function getHeartgardenCollabMetricsSnapshot(): Snapshot {
  return {
    spaceSyncRuns: { ...spaceSyncRuns },
    realtimeWsConnects,
    realtimeWsDisconnects,
    realtimeMessagesReceived,
    pollContractFailures,
    bootstrapRepairAttempts,
  };
}

/** Expose for ad-hoc debugging in devtools: `__heartgardenCollabMetrics.snapshot()`. */
export function installHeartgardenCollabMetricsGlobal(): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as {
    __heartgardenCollabMetrics?: { snapshot: () => Snapshot; reset: () => void };
  };
  if (w.__heartgardenCollabMetrics) return;
  w.__heartgardenCollabMetrics = {
    snapshot: () => getHeartgardenCollabMetricsSnapshot(),
    reset: () => {
      spaceSyncRuns.poll_interval = 0;
      spaceSyncRuns.realtime_invalidate = 0;
      spaceSyncRuns.initial = 0;
      spaceSyncRuns.visibility = 0;
      realtimeWsConnects = 0;
      realtimeWsDisconnects = 0;
      realtimeMessagesReceived = 0;
      pollContractFailures = 0;
      bootstrapRepairAttempts = 0;
      emit();
    },
  };
}
