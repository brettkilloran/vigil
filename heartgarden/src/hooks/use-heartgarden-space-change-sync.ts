"use client";

import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useEffect,
  useRef,
} from "react";

import { mergeBootstrapView } from "@/src/components/foundation/architectural-db-bridge";
import {
  fetchBootstrap,
  fetchSpaceChanges,
} from "@/src/components/foundation/architectural-neon-api";
import type { CanvasGraph } from "@/src/components/foundation/architectural-types";
import {
  HEARTGARDEN_COLLA_POLL_ERROR_SNIPPET,
  HEARTGARDEN_COLLA_POLL_FAILURE_USER_MESSAGE,
  HEARTGARDEN_SPACE_CHANGE_POLL_MS_COLLAB,
  HEARTGARDEN_SPACE_CHANGE_POLL_MS_SOLO,
} from "@/src/lib/heartgarden-collab-constants";
import {
  type HeartgardenSpaceSyncRunSource,
  recordBootstrapRepairAttempt,
  recordHeartgardenSpaceSyncRun,
  recordPollContractFailure,
} from "@/src/lib/heartgarden-collab-metrics";
import {
  applySpaceChangeGraphMerge,
  buildCollabMergeProtectedContentIds,
  collectItemServerUpdatedAtBumps,
  mergeItemServerUpdatedAtIfNewer,
  mergeLatestIsoCursor,
} from "@/src/lib/heartgarden-space-change-sync-utils";
import {
  neonSyncClearLastErrorIfContains,
  neonSyncReportAuxiliaryFailure,
  neonSyncSpaceChangeSyncBreadcrumb,
} from "@/src/lib/neon-sync-bus";

const AUX_FAILURE_AFTER_CONSECUTIVE_MISSES = 3;
// REVIEW_2026-04-22-2 H4: request the full subtree `itemIds` snapshot only on the
// first poll after (re)mount and then at a slow reconciliation cadence; between
// snapshots, rely on `cursor` + `itemLinksRevision` for incremental sync. This
// stops the per-poll full ID scan + payload amplification while still catching
// remote hard-deletes within one reconciliation window.
const SUBTREE_ID_SNAPSHOT_INTERVAL_MS = 60_000;

export function useHeartgardenSpaceChangeSync(options: {
  enabled: boolean;
  /** True when presence lists at least one other client in this space (excludes self). */
  hasRemotePeers: boolean;
  refreshNonce?: number;
  activeSpaceId: string;
  syncCursorRef: MutableRefObject<string>;
  focusOpenRef: MutableRefObject<boolean>;
  focusDirtyRef: MutableRefObject<boolean>;
  activeNodeIdRef: MutableRefObject<string | null>;
  inlineContentDirtyIdsRef: MutableRefObject<Set<string>>;
  /** Item ids with an in-flight item PATCH (see `patchItemWithVersion` in the shell). */
  savingContentIdsRef: MutableRefObject<Set<string>>;
  /** Locally edited ids protected from stale remote rows for a short grace window. */
  optimisticProtectedIdsRef?: MutableRefObject<Set<string>>;
  /** Skips remote tombstone deletes for these item ids (undo restore in flight). */
  remoteTombstoneExemptIdsRef: MutableRefObject<Set<string>>;
  setGraph: Dispatch<SetStateAction<CanvasGraph>>;
  itemServerUpdatedAtRef: MutableRefObject<Map<string, string>>;
  /**
   * After item/space rows merge from poll or realtime catch-up.
   * `itemLinksRevision` comes from `GET …/changes` — compare to last seen before downloading `GET …/graph`.
   */
  onAfterSpaceChangeMerge?: (info: {
    source: HeartgardenSpaceSyncRunSource;
    itemLinksRevision?: string;
  }) => void;
}): void {
  const {
    enabled,
    hasRemotePeers,
    refreshNonce = 0,
    activeSpaceId,
    syncCursorRef,
    focusOpenRef,
    focusDirtyRef,
    activeNodeIdRef,
    inlineContentDirtyIdsRef,
    savingContentIdsRef,
    optimisticProtectedIdsRef,
    remoteTombstoneExemptIdsRef,
    setGraph,
    itemServerUpdatedAtRef,
    onAfterSpaceChangeMerge,
  } = options;

  const consecutiveMissesRef = useRef(0);
  const runRef = useRef<
    ((source: HeartgardenSpaceSyncRunSource) => Promise<void>) | null
  >(null);
  // REVIEW_2026-04-22-2 H4: throttle full subtree id snapshots across polls.
  // `lastItemIdsSnapshotAtRef = 0` forces a snapshot on the first poll after
  // mount or on a space change (handled by effect re-run on `activeSpaceId`).
  const lastItemIdsSnapshotAtRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      consecutiveMissesRef.current = 0;
      runRef.current = null;
      return;
    }

    let cancelled = false;
    let inFlight = false;
    let pollTimer: number | null = null;
    let pollCatchupTimer: number | null = null;
    let inFlightAbort: AbortController | null = null;
    // Reset snapshot TTL on each (re)run so a freshly-activated space always
    // performs one tombstone-capable snapshot before falling back to deltas.
    lastItemIdsSnapshotAtRef.current = 0;

    const shouldDeferPollForBusyEditing = () =>
      inlineContentDirtyIdsRef.current.size > 0 ||
      savingContentIdsRef.current.size > 0;

    const tryBootstrapRepair = async (): Promise<boolean> => {
      recordBootstrapRepairAttempt();
      neonSyncSpaceChangeSyncBreadcrumb("bootstrap repair attempt");
      const boot = await fetchBootstrap(activeSpaceId);
      if (cancelled || !boot || boot.demo !== false || !boot.spaceId) {
        neonSyncSpaceChangeSyncBreadcrumb(
          "bootstrap repair skipped (no cloud payload)"
        );
        return false;
      }
      setGraph((prev) => mergeBootstrapView(prev, boot));
      let maxMs = Date.parse(syncCursorRef.current);
      if (!Number.isFinite(maxMs)) {
        maxMs = 0;
      }
      for (const it of boot.items) {
        if (!it.updatedAt) {
          continue;
        }
        mergeItemServerUpdatedAtIfNewer(
          itemServerUpdatedAtRef.current,
          it.id,
          it.updatedAt
        );
        const t = Date.parse(it.updatedAt);
        if (Number.isFinite(t) && t > maxMs) {
          maxMs = t;
        }
      }
      syncCursorRef.current = new Date(maxMs).toISOString();
      neonSyncClearLastErrorIfContains(HEARTGARDEN_COLLA_POLL_ERROR_SNIPPET);
      neonSyncSpaceChangeSyncBreadcrumb("bootstrap repair applied");
      return true;
    };

    const onRepeatedPollFailure = () => {
      consecutiveMissesRef.current += 1;
      if (consecutiveMissesRef.current < AUX_FAILURE_AFTER_CONSECUTIVE_MISSES) {
        return;
      }
      recordPollContractFailure();
      neonSyncReportAuxiliaryFailure(
        HEARTGARDEN_COLLA_POLL_FAILURE_USER_MESSAGE
      );
      neonSyncSpaceChangeSyncBreadcrumb(
        `poll contract failure x${AUX_FAILURE_AFTER_CONSECUTIVE_MISSES}; scheduling bootstrap repair`
      );
      void tryBootstrapRepair();
      consecutiveMissesRef.current = 0;
    };

    async function run(source: HeartgardenSpaceSyncRunSource) {
      if (cancelled || document.visibilityState === "hidden" || inFlight) {
        return;
      }
      if (
        shouldDeferPollForBusyEditing() &&
        (source === "poll_interval" || source === "poll_catchup")
      ) {
        scheduleDeferredPollCatchup();
        return;
      }
      recordHeartgardenSpaceSyncRun(source);
      inFlight = true;
      inFlightAbort = new AbortController();
      try {
        let sinceCursor = syncCursorRef.current;
        let firstPage = true;
        let lastItemLinksRevision: string | undefined;
        // REVIEW_2026-04-22-2 H4: only request the full subtree `itemIds` snapshot
        // on page 1 AND when either we've never snapshotted in this run or the
        // reconciliation TTL has elapsed. Other poll cycles use pure delta data.
        const nowMs = Date.now();
        const snapshotDue =
          lastItemIdsSnapshotAtRef.current === 0 ||
          nowMs - lastItemIdsSnapshotAtRef.current >=
            SUBTREE_ID_SNAPSHOT_INTERVAL_MS;
        if (snapshotDue) {
          lastItemIdsSnapshotAtRef.current = nowMs;
        }

        while (true) {
          const data = await fetchSpaceChanges(activeSpaceId, sinceCursor, {
            includeItemIds: firstPage && snapshotDue,
            signal: inFlightAbort.signal,
          });
          firstPage = false;
          if (cancelled) {
            return;
          }
          if (!data.ok) {
            neonSyncSpaceChangeSyncBreadcrumb(
              `poll failure (${data.cause})${data.httpStatus ? ` status=${data.httpStatus}` : ""}: ${data.error}`
            );
            neonSyncReportAuxiliaryFailure({
              cause:
                data.cause === "http"
                  ? "http"
                  : data.cause === "network"
                    ? "network"
                    : "client",
              message: data.error,
              operation: `GET /api/spaces/${activeSpaceId}/changes`,
              ...(data.httpStatus == null
                ? {}
                : { httpStatus: data.httpStatus }),
            });
            onRepeatedPollFailure();
            return;
          }
          consecutiveMissesRef.current = 0;
          neonSyncClearLastErrorIfContains(
            HEARTGARDEN_COLLA_POLL_ERROR_SNIPPET
          );

          const nextCursor = mergeLatestIsoCursor(sinceCursor, data.cursor);
          sinceCursor = nextCursor;
          syncCursorRef.current = nextCursor;

          // REVIEW_2026-04-22-2 C1: only pages that explicitly carry `itemIds` are
          // authoritative subtree snapshots. Subsequent pagination pages must pass
          // `null` so partial deltas cannot tombstone the local graph.
          const serverIds: ReadonlySet<string> | null = data.itemIds
            ? new Set(data.itemIds)
            : null;
          const protectedContentIds = buildCollabMergeProtectedContentIds({
            activeNodeId: activeNodeIdRef.current,
            focusDirty: focusDirtyRef.current,
            focusOpen: focusOpenRef.current,
            inlineContentDirtyIds: inlineContentDirtyIdsRef.current,
            savingContentIds: savingContentIdsRef.current,
          });
          optimisticProtectedIdsRef?.current.forEach((id) =>
            protectedContentIds.add(id)
          );
          const rawItems = data.items ?? [];
          const rawSpaces = (data.spaces ?? []).map((s) => ({
            id: s.id,
            name: s.name,
            parentSpaceId: s.parentSpaceId ?? null,
          }));
          setGraph((prev) =>
            applySpaceChangeGraphMerge({
              activeSpaceId,
              prev,
              protectedContentIds,
              rawItems,
              rawSpaceRows: rawSpaces,
              serverItemIds: serverIds,
              tombstoneExemptIds: remoteTombstoneExemptIdsRef.current,
            })
          );
          for (const bump of collectItemServerUpdatedAtBumps(
            rawItems,
            protectedContentIds
          )) {
            mergeItemServerUpdatedAtIfNewer(
              itemServerUpdatedAtRef.current,
              bump.id,
              bump.updatedAt
            );
          }
          if (typeof data.itemLinksRevision === "string") {
            lastItemLinksRevision = data.itemLinksRevision;
          }
          if (data.hasMore !== true) {
            break;
          }
        }

        onAfterSpaceChangeMerge?.({
          itemLinksRevision: lastItemLinksRevision,
          source,
        });
      } finally {
        inFlightAbort = null;
        inFlight = false;
      }
    }

    const scheduleDeferredPollCatchup = () => {
      if (pollCatchupTimer != null) {
        window.clearTimeout(pollCatchupTimer);
      }
      pollCatchupTimer = window.setTimeout(() => {
        pollCatchupTimer = null;
        if (cancelled || document.visibilityState === "hidden") {
          return;
        }
        void run("poll_catchup");
      }, 650);
    };

    runRef.current = run;

    const stopPoll = () => {
      if (pollTimer != null) {
        window.clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const pollMs = hasRemotePeers
      ? HEARTGARDEN_SPACE_CHANGE_POLL_MS_COLLAB
      : HEARTGARDEN_SPACE_CHANGE_POLL_MS_SOLO;

    const startPoll = () => {
      if (pollTimer != null || document.visibilityState === "hidden") {
        return;
      }
      pollTimer = window.setInterval(() => {
        void run("poll_interval");
      }, pollMs);
    };

    const onVisibility = () => {
      if (cancelled) {
        return;
      }
      if (document.visibilityState === "hidden") {
        stopPoll();
        return;
      }
      startPoll();
      void run("visibility");
    };

    document.addEventListener("visibilitychange", onVisibility);
    if (document.visibilityState !== "hidden") {
      startPoll();
      void run("initial");
    }

    return () => {
      cancelled = true;
      inFlightAbort?.abort();
      stopPoll();
      if (pollCatchupTimer != null) {
        window.clearTimeout(pollCatchupTimer);
        pollCatchupTimer = null;
      }
      runRef.current = null;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [
    enabled,
    hasRemotePeers,
    activeSpaceId,
    syncCursorRef,
    focusOpenRef,
    focusDirtyRef,
    activeNodeIdRef,
    inlineContentDirtyIdsRef,
    savingContentIdsRef,
    optimisticProtectedIdsRef,
    remoteTombstoneExemptIdsRef,
    setGraph,
    itemServerUpdatedAtRef,
    onAfterSpaceChangeMerge,
  ]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (refreshNonce === 0) {
      return;
    }
    void runRef.current?.("realtime_invalidate");
  }, [enabled, refreshNonce]);
}
