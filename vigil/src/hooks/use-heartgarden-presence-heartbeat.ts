"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

import {
  fetchSpacePresencePeersDetail,
  postPresencePayload,
  type SpacePresencePeer,
} from "@/src/components/foundation/architectural-neon-api";
import {
  HEARTGARDEN_PRESENCE_HEARTBEAT_MS,
  HEARTGARDEN_PRESENCE_PEER_POLL_MS,
} from "@/src/lib/heartgarden-collab-constants";
import { getOrCreatePresenceClientId } from "@/src/lib/heartgarden-presence-client";
import type { CameraState } from "@/src/model/canvas-types";

export type { SpacePresencePeer };

export function useHeartgardenPresenceHeartbeat(options: {
  enabled: boolean;
  activeSpaceId: string;
  getPayload: () => { camera: CameraState; pointer: { x: number; y: number } | null };
  onPeersUpdate: (peers: SpacePresencePeer[]) => void;
}): void {
  const { enabled, activeSpaceId, getPayload, onPeersUpdate } = options;
  const getPayloadRef = useRef(getPayload);
  const onPeersRef = useRef(onPeersUpdate);
  useLayoutEffect(() => {
    getPayloadRef.current = getPayload;
    onPeersRef.current = onPeersUpdate;
  });

  useEffect(() => {
    if (!enabled) {
      onPeersRef.current([]);
      return;
    }

    onPeersRef.current([]);

    const clientId = getOrCreatePresenceClientId();
    if (!clientId) return;

    let cancelled = false;
    let hbTimer: number | null = null;
    let pollTimer: number | null = null;

    const beat = () => {
      if (cancelled || document.visibilityState === "hidden") return;
      const p = getPayloadRef.current();
      void postPresencePayload(activeSpaceId, clientId, p);
    };

    const poll = async () => {
      if (cancelled || document.visibilityState === "hidden") return;
      const peers = await fetchSpacePresencePeersDetail(activeSpaceId, clientId);
      if (!cancelled) onPeersRef.current(peers);
    };

    const stopTimers = () => {
      if (hbTimer != null) {
        window.clearInterval(hbTimer);
        hbTimer = null;
      }
      if (pollTimer != null) {
        window.clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const startTimers = () => {
      if (cancelled || document.visibilityState === "hidden") return;
      if (hbTimer == null) {
        hbTimer = window.setInterval(beat, HEARTGARDEN_PRESENCE_HEARTBEAT_MS);
      }
      if (pollTimer == null) {
        pollTimer = window.setInterval(poll, HEARTGARDEN_PRESENCE_PEER_POLL_MS);
      }
    };

    const onVisibility = () => {
      if (cancelled) return;
      if (document.visibilityState === "hidden") {
        stopTimers();
        return;
      }
      startTimers();
      beat();
      void poll();
    };

    document.addEventListener("visibilitychange", onVisibility);
    if (document.visibilityState !== "hidden") {
      startTimers();
      beat();
      void poll();
    }

    return () => {
      cancelled = true;
      stopTimers();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, activeSpaceId]);
}

/** Plan / collab docs alias — same as {@link useHeartgardenPresenceHeartbeat}. */
export { useHeartgardenPresenceHeartbeat as usePresenceHeartbeat };
