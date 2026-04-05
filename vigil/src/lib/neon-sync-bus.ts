import {
  formatSyncFailureReport,
  type SyncFailureDetail,
} from "@/src/lib/sync-error-diagnostic";

export type NeonSyncFailureInput = string | SyncFailureDetail;

export type NeonSyncSnapshot = {
  /** True when `NEON_DATABASE_URL` bootstrap succeeded (not demo seed). */
  cloudEnabled: boolean;
  /** Debounced writes not yet sent (e.g. note body waiting for idle). */
  pending: number;
  /** In-flight HTTP mutations to Neon. */
  inFlight: number;
  lastError: string | null;
  /** Last successful mutation completion (ms epoch). */
  lastSavedAt: number | null;
};

let cloudEnabled = false;
let pending = 0;
let inFlight = 0;
let lastError: string | null = null;
let lastSavedAt: number | null = null;

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function subscribeNeonSync(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** Stable reference for SSR / prerender — must not change identity between calls. */
const NEON_SYNC_SERVER_SNAPSHOT: NeonSyncSnapshot = Object.freeze({
  cloudEnabled: false,
  pending: 0,
  inFlight: 0,
  lastError: null,
  lastSavedAt: null,
});

let neonSyncSnapshotCache: NeonSyncSnapshot | null = null;

function snapshotsEqual(a: NeonSyncSnapshot, b: NeonSyncSnapshot): boolean {
  return (
    a.cloudEnabled === b.cloudEnabled &&
    a.pending === b.pending &&
    a.inFlight === b.inFlight &&
    a.lastError === b.lastError &&
    a.lastSavedAt === b.lastSavedAt
  );
}

/**
 * Client snapshot for `useSyncExternalStore`. Reuses the same object reference when
 * values are unchanged — returning a fresh object every call causes infinite re-renders.
 */
export function getNeonSyncSnapshot(): NeonSyncSnapshot {
  const next: NeonSyncSnapshot = {
    cloudEnabled,
    pending,
    inFlight,
    lastError,
    lastSavedAt,
  };
  if (neonSyncSnapshotCache && snapshotsEqual(neonSyncSnapshotCache, next)) {
    return neonSyncSnapshotCache;
  }
  neonSyncSnapshotCache = next;
  return next;
}

/** Server/prerender snapshot — same reference every time (React requirement). */
export function getNeonSyncServerSnapshot(): NeonSyncSnapshot {
  return NEON_SYNC_SERVER_SNAPSHOT;
}

/** Call when bootstrap resolves (demo vs real Neon). Resets counters when turning cloud off. */
export function neonSyncSetCloudEnabled(enabled: boolean) {
  if (cloudEnabled === enabled) return;
  cloudEnabled = enabled;
  if (!enabled) {
    pending = 0;
    inFlight = 0;
    lastError = null;
  } else {
    lastError = null;
  }
  emit();
}

/** First debounced timer scheduled for a key (e.g. entity id). */
export function neonSyncBumpPending() {
  pending += 1;
  emit();
}

/** Debounce flushed or cancelled before send. */
export function neonSyncUnbumpPending() {
  pending = Math.max(0, pending - 1);
  emit();
}

export function neonSyncBeginRequest() {
  inFlight += 1;
  lastError = null;
  emit();
}

export function neonSyncEndRequest(ok: boolean, detail?: NeonSyncFailureInput) {
  inFlight = Math.max(0, inFlight - 1);
  if (ok) {
    lastSavedAt = Date.now();
  } else if (!detail) {
    lastError = formatSyncFailureReport(
      { operation: "(unknown)", message: "Save failed", cause: "client" },
      { cloudEnabled },
    );
  } else if (typeof detail === "string") {
    const m = detail.trim() || "Save failed";
    lastError = formatSyncFailureReport(
      { operation: "(unspecified API call)", message: m, cause: "client" },
      { cloudEnabled },
    );
  } else {
    lastError = formatSyncFailureReport(detail, { cloudEnabled });
  }
  emit();
}

/** For failures that did not use {@link neonSyncBeginRequest} (e.g. item-link fetches). */
export function neonSyncReportAuxiliaryFailure(detail: NeonSyncFailureInput) {
  if (!cloudEnabled) return;
  if (typeof detail === "string") {
    lastError = formatSyncFailureReport(
      {
        operation: "(client sync)",
        message: detail.trim() || "Sync error",
        cause: "client",
      },
      { cloudEnabled },
    );
  } else {
    lastError = formatSyncFailureReport(detail, { cloudEnabled });
  }
  emit();
}

export function formatSavedRelative(ts: number | null): string {
  if (ts == null) return "";
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 8) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
