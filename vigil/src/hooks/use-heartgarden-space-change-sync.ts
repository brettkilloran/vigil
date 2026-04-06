"use client";

import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

import { mergeRemoteItemPatches } from "@/src/components/foundation/architectural-db-bridge";
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

    const run = async () => {
      if (cancelled || document.visibilityState === "hidden" || inFlight) return;
      inFlight = true;
      try {
        const since = syncCursorRef.current;
        const data = await fetchSpaceChanges(activeSpaceId, since);
        if (cancelled) return;
        if (!data?.itemIds) {
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
        const graphSnap = graphRef.current;
        const spaceRows = Object.values(graphSnap.spaces).map((s) => ({
          id: s.id,
          parentSpaceId: s.parentSpaceId ?? null,
        }));
        const subtree = collectSpaceSubtreeIds(activeSpaceId, spaceRows);
        const serverIds = new Set(data.itemIds);
        const protectedContentIds = new Set<string>();
        if (focusOpenRef.current && focusDirtyRef.current && activeNodeIdRef.current) {
          protectedContentIds.add(activeNodeIdRef.current);
        }
        inlineContentDirtyIdsRef.current.forEach((id) => protectedContentIds.add(id));
        const rawItems = data.items ?? [];
        setGraph((prev) =>
          mergeRemoteItemPatches(prev, rawItems, serverIds, subtree, protectedContentIds),
        );
        for (const it of rawItems) {
          if (it.updatedAt) itemServerUpdatedAtRef.current.set(it.id, it.updatedAt);
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
    setGraph,
    itemServerUpdatedAtRef,
  ]);
}
