"use client";

import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

import { mergeBootstrapView } from "@/src/components/foundation/architectural-db-bridge";
import type { CanvasGraph } from "@/src/components/foundation/architectural-types";
import { fetchBootstrap, fetchSpaceChanges } from "@/src/components/foundation/architectural-neon-api";
import {
  HEARTGARDEN_COLLA_POLL_ERROR_SNIPPET,
  HEARTGARDEN_COLLA_POLL_FAILURE_USER_MESSAGE,
  HEARTGARDEN_SPACE_CHANGE_POLL_MS_COLLAB,
  HEARTGARDEN_SPACE_CHANGE_POLL_MS_SOLO,
} from "@/src/lib/heartgarden-collab-constants";
import {
  recordBootstrapRepairAttempt,
  recordHeartgardenSpaceSyncRun,
  recordPollContractFailure,
  type HeartgardenSpaceSyncRunSource,
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
    remoteTombstoneExemptIdsRef,
    setGraph,
    itemServerUpdatedAtRef,
    onAfterSpaceChangeMerge,
  } = options;

  const consecutiveMissesRef = useRef(0);
  const runRef = useRef<((source: HeartgardenSpaceSyncRunSource) => Promise<void>) | null>(null);

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

    const shouldDeferPollForBusyEditing = () =>
      inlineContentDirtyIdsRef.current.size > 0 || savingContentIdsRef.current.size > 0;

    const tryBootstrapRepair = async (): Promise<boolean> => {
      recordBootstrapRepairAttempt();
      neonSyncSpaceChangeSyncBreadcrumb("bootstrap repair attempt");
      const boot = await fetchBootstrap(activeSpaceId);
      if (cancelled || !boot || boot.demo !== false || !boot.spaceId) {
        neonSyncSpaceChangeSyncBreadcrumb("bootstrap repair skipped (no cloud payload)");
        return false;
      }
      setGraph((prev) => mergeBootstrapView(prev, boot));
      let maxMs = Date.parse(syncCursorRef.current);
      if (!Number.isFinite(maxMs)) maxMs = 0;
      for (const it of boot.items) {
        if (!it.updatedAt) continue;
        mergeItemServerUpdatedAtIfNewer(itemServerUpdatedAtRef.current, it.id, it.updatedAt);
        const t = Date.parse(it.updatedAt);
        if (Number.isFinite(t) && t > maxMs) maxMs = t;
      }
      syncCursorRef.current = new Date(maxMs).toISOString();
      neonSyncClearLastErrorIfContains(HEARTGARDEN_COLLA_POLL_ERROR_SNIPPET);
      neonSyncSpaceChangeSyncBreadcrumb("bootstrap repair applied");
      return true;
    };

    const onRepeatedPollFailure = () => {
      consecutiveMissesRef.current += 1;
      if (consecutiveMissesRef.current < AUX_FAILURE_AFTER_CONSECUTIVE_MISSES) return;
      recordPollContractFailure();
      neonSyncReportAuxiliaryFailure(HEARTGARDEN_COLLA_POLL_FAILURE_USER_MESSAGE);
      neonSyncSpaceChangeSyncBreadcrumb(
        `poll contract failure x${AUX_FAILURE_AFTER_CONSECUTIVE_MISSES}; scheduling bootstrap repair`,
      );
      void tryBootstrapRepair();
      consecutiveMissesRef.current = 0;
    };

    async function run(source: HeartgardenSpaceSyncRunSource) {
      if (cancelled || document.visibilityState === "hidden" || inFlight) return;
      if (
        shouldDeferPollForBusyEditing() &&
        (source === "poll_interval" || source === "poll_catchup")
      ) {
        scheduleDeferredPollCatchup();
        return;
      }
      recordHeartgardenSpaceSyncRun(source);
      inFlight = true;
      try {
        let sinceCursor = syncCursorRef.current;
        let firstPage = true;
        let lastItemLinksRevision: string | undefined;

        while (true) {
          const data = await fetchSpaceChanges(activeSpaceId, sinceCursor, {
            includeItemIds: firstPage,
          });
          firstPage = false;
          if (cancelled) return;
          if (!data) {
            onRepeatedPollFailure();
            return;
          }
          consecutiveMissesRef.current = 0;
          neonSyncClearLastErrorIfContains(HEARTGARDEN_COLLA_POLL_ERROR_SNIPPET);

          const nextCursor = mergeLatestIsoCursor(sinceCursor, data.cursor);
          sinceCursor = nextCursor;
          syncCursorRef.current = nextCursor;

          const serverIds: ReadonlySet<string> = new Set(data.itemIds ?? []);
          const protectedContentIds = buildCollabMergeProtectedContentIds({
            focusOpen: focusOpenRef.current,
            focusDirty: focusDirtyRef.current,
            activeNodeId: activeNodeIdRef.current,
            inlineContentDirtyIds: inlineContentDirtyIdsRef.current,
            savingContentIds: savingContentIdsRef.current,
          });
          const rawItems = data.items ?? [];
          const rawSpaces = (data.spaces ?? []).map((s) => ({
            id: s.id,
            name: s.name,
            parentSpaceId: s.parentSpaceId ?? null,
          }));
          setGraph((prev) =>
            applySpaceChangeGraphMerge({
              prev,
              activeSpaceId,
              rawItems,
              rawSpaceRows: rawSpaces,
              serverItemIds: serverIds,
              protectedContentIds,
              tombstoneExemptIds: remoteTombstoneExemptIdsRef.current,
            }),
          );
          for (const bump of collectItemServerUpdatedAtBumps(rawItems, protectedContentIds)) {
            mergeItemServerUpdatedAtIfNewer(itemServerUpdatedAtRef.current, bump.id, bump.updatedAt);
          }
          if (typeof data.itemLinksRevision === "string") {
            lastItemLinksRevision = data.itemLinksRevision;
          }
          if (data.hasMore !== true) break;
        }

        onAfterSpaceChangeMerge?.({
          source,
          itemLinksRevision: lastItemLinksRevision,
        });
      } finally {
        inFlight = false;
      }
    }

    const scheduleDeferredPollCatchup = () => {
      if (pollCatchupTimer != null) window.clearTimeout(pollCatchupTimer);
      pollCatchupTimer = window.setTimeout(() => {
        pollCatchupTimer = null;
        if (cancelled || document.visibilityState === "hidden") return;
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
      if (pollTimer != null || document.visibilityState === "hidden") return;
      pollTimer = window.setInterval(() => {
        void run("poll_interval");
      }, pollMs);
    };

    const onVisibility = () => {
      if (cancelled) return;
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
    remoteTombstoneExemptIdsRef,
    setGraph,
    itemServerUpdatedAtRef,
    onAfterSpaceChangeMerge,
  ]);

  useEffect(() => {
    if (!enabled) return;
    if (refreshNonce === 0) return;
    void runRef.current?.("realtime_invalidate");
  }, [enabled, refreshNonce]);
}
