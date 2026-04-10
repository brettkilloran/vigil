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
  applySpaceChangeGraphMerge,
  buildCollabMergeProtectedContentIds,
  collectItemServerUpdatedAtBumps,
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
  activeSpaceId: string;
  syncCursorRef: MutableRefObject<string>;
  focusOpenRef: MutableRefObject<boolean>;
  focusDirtyRef: MutableRefObject<boolean>;
  activeNodeIdRef: MutableRefObject<string | null>;
  inlineContentDirtyIdsRef: MutableRefObject<Set<string>>;
  /** Skips remote tombstone deletes for these item ids (undo restore in flight). */
  remoteTombstoneExemptIdsRef: MutableRefObject<Set<string>>;
  setGraph: Dispatch<SetStateAction<CanvasGraph>>;
  itemServerUpdatedAtRef: MutableRefObject<Map<string, string>>;
}): void {
  const {
    enabled,
    hasRemotePeers,
    activeSpaceId,
    syncCursorRef,
    focusOpenRef,
    focusDirtyRef,
    activeNodeIdRef,
    inlineContentDirtyIdsRef,
    remoteTombstoneExemptIdsRef,
    setGraph,
    itemServerUpdatedAtRef,
  } = options;

  const consecutiveMissesRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      consecutiveMissesRef.current = 0;
      return;
    }

    let cancelled = false;
    let inFlight = false;
    let pollTimer: number | null = null;

    const tryBootstrapRepair = async (): Promise<boolean> => {
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
        itemServerUpdatedAtRef.current.set(it.id, it.updatedAt);
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
      neonSyncReportAuxiliaryFailure(HEARTGARDEN_COLLA_POLL_FAILURE_USER_MESSAGE);
      neonSyncSpaceChangeSyncBreadcrumb(
        `poll contract failure x${AUX_FAILURE_AFTER_CONSECUTIVE_MISSES}; scheduling bootstrap repair`,
      );
      void tryBootstrapRepair();
      consecutiveMissesRef.current = 0;
    };

    const run = async () => {
      if (cancelled || document.visibilityState === "hidden" || inFlight) return;
      inFlight = true;
      try {
        const since = syncCursorRef.current;
        const data = await fetchSpaceChanges(activeSpaceId, since, {
          // Always request full subtree ids so remote tombstones propagate while peers stay active.
          includeItemIds: true,
        });
        if (cancelled) return;
        if (!data) {
          onRepeatedPollFailure();
          return;
        }
        consecutiveMissesRef.current = 0;
        neonSyncClearLastErrorIfContains(HEARTGARDEN_COLLA_POLL_ERROR_SNIPPET);
        const nextCursor = mergeLatestIsoCursor(since, data.cursor);
        syncCursorRef.current = nextCursor;
        const serverIds: ReadonlySet<string> = new Set(data.itemIds ?? []);
        const protectedContentIds = buildCollabMergeProtectedContentIds({
          focusOpen: focusOpenRef.current,
          focusDirty: focusDirtyRef.current,
          activeNodeId: activeNodeIdRef.current,
          inlineContentDirtyIds: inlineContentDirtyIdsRef.current,
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
          itemServerUpdatedAtRef.current.set(bump.id, bump.updatedAt);
        }
      } finally {
        inFlight = false;
      }
    };

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
      pollTimer = window.setInterval(run, pollMs);
    };

    const onVisibility = () => {
      if (cancelled) return;
      if (document.visibilityState === "hidden") {
        stopPoll();
        return;
      }
      startPoll();
      void run();
    };

    document.addEventListener("visibilitychange", onVisibility);
    if (document.visibilityState !== "hidden") {
      startPoll();
      void run();
    }

    return () => {
      cancelled = true;
      stopPoll();
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
    remoteTombstoneExemptIdsRef,
    setGraph,
    itemServerUpdatedAtRef,
  ]);
}
