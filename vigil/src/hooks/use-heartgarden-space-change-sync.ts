"use client";

import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

import {
  mergeRemoteItemPatches,
  mergeRemoteSpaceRowsIntoGraph,
} from "@/src/components/foundation/architectural-db-bridge";
import type { CanvasGraph } from "@/src/components/foundation/architectural-types";
import { fetchSpaceChanges } from "@/src/components/foundation/architectural-neon-api";
import {
  HEARTGARDEN_COLLA_POLL_ERROR_SNIPPET,
  HEARTGARDEN_COLLA_POLL_FAILURE_USER_MESSAGE,
  HEARTGARDEN_SPACE_CHANGE_POLL_MS,
} from "@/src/lib/heartgarden-collab-constants";
import {
  neonSyncClearLastErrorIfContains,
  neonSyncReportAuxiliaryFailure,
} from "@/src/lib/neon-sync-bus";
import { buildCollabMergeProtectedContentIds } from "@/src/lib/heartgarden-space-change-sync-utils";
import { collectSpaceSubtreeIds } from "@/src/lib/spaces";

const AUX_FAILURE_AFTER_CONSECUTIVE_MISSES = 3;

export function useHeartgardenSpaceChangeSync(options: {
  enabled: boolean;
  activeSpaceId: string;
  graphRef: MutableRefObject<CanvasGraph>;
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
    activeSpaceId,
    graphRef,
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
  const needFullItemIdsRef = useRef(true);

  useEffect(() => {
    if (!enabled) {
      consecutiveMissesRef.current = 0;
      return;
    }

    needFullItemIdsRef.current = true;

    let cancelled = false;
    let inFlight = false;
    let pollTimer: number | null = null;

    const run = async () => {
      if (cancelled || document.visibilityState === "hidden" || inFlight) return;
      inFlight = true;
      try {
        const since = syncCursorRef.current;
        const wantFull = needFullItemIdsRef.current;
        const data = await fetchSpaceChanges(activeSpaceId, since, {
          includeItemIds: wantFull,
        });
        if (cancelled) return;
        if (!data) {
          consecutiveMissesRef.current += 1;
          if (consecutiveMissesRef.current >= AUX_FAILURE_AFTER_CONSECUTIVE_MISSES) {
            neonSyncReportAuxiliaryFailure(HEARTGARDEN_COLLA_POLL_FAILURE_USER_MESSAGE);
            consecutiveMissesRef.current = 0;
          }
          return;
        }
        if (wantFull && !Array.isArray(data.itemIds)) {
          consecutiveMissesRef.current += 1;
          if (consecutiveMissesRef.current >= AUX_FAILURE_AFTER_CONSECUTIVE_MISSES) {
            neonSyncReportAuxiliaryFailure(HEARTGARDEN_COLLA_POLL_FAILURE_USER_MESSAGE);
            consecutiveMissesRef.current = 0;
          }
          return;
        }
        consecutiveMissesRef.current = 0;
        neonSyncClearLastErrorIfContains(HEARTGARDEN_COLLA_POLL_ERROR_SNIPPET);
        if (typeof data.cursor === "string" && data.cursor.length > 0) {
          syncCursorRef.current = data.cursor;
        }
        if (Array.isArray(data.itemIds)) {
          needFullItemIdsRef.current = false;
        }
        const serverIds: ReadonlySet<string> | null = Array.isArray(data.itemIds)
          ? new Set(data.itemIds)
          : null;
        const graphSnap = graphRef.current;
        const spaceRows = Object.values(graphSnap.spaces).map((s) => ({
          id: s.id,
          parentSpaceId: s.parentSpaceId ?? null,
        }));
        const subtree = collectSpaceSubtreeIds(activeSpaceId, spaceRows);
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
        setGraph((prev) => {
          const mergedItems = mergeRemoteItemPatches(
            prev,
            rawItems,
            serverIds,
            subtree,
            protectedContentIds,
            remoteTombstoneExemptIdsRef.current,
          );
          return mergeRemoteSpaceRowsIntoGraph(mergedItems, rawSpaces);
        });
        // Do not bump baseUpdatedAt for cards with local draft — avoids 409 races with debounced saves
        // and our own echo on the delta feed while the editor is dirty (merge already skips body for these).
        for (const it of rawItems) {
          if (it.updatedAt && !protectedContentIds.has(it.id)) {
            itemServerUpdatedAtRef.current.set(it.id, it.updatedAt);
          }
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

    const startPoll = () => {
      if (pollTimer != null || document.visibilityState === "hidden") return;
      pollTimer = window.setInterval(run, HEARTGARDEN_SPACE_CHANGE_POLL_MS);
    };

    const onVisibility = () => {
      if (cancelled) return;
      if (document.visibilityState === "hidden") {
        stopPoll();
        return;
      }
      needFullItemIdsRef.current = true;
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
    activeSpaceId,
    graphRef,
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

/** Plan / collab docs alias — same as {@link useHeartgardenSpaceChangeSync}. */
export { useHeartgardenSpaceChangeSync as useSpaceChangeSync };
