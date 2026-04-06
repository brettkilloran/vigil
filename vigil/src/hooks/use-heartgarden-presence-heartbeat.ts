"use client";

import { useEffect } from "react";

import {
  fetchSpacePresencePeers,
  postPresenceHeartbeat,
} from "@/src/components/foundation/architectural-neon-api";
import {
  HEARTGARDEN_PRESENCE_HEARTBEAT_MS,
  HEARTGARDEN_PRESENCE_PEER_POLL_MS,
} from "@/src/lib/heartgarden-collab-constants";
import { getOrCreatePresenceClientId } from "@/src/lib/heartgarden-presence-client";

export function useHeartgardenPresenceHeartbeat(options: {
  enabled: boolean;
  activeSpaceId: string;
  setPresencePeerCount: (n: number) => void;
}): void {
  const { enabled, activeSpaceId, setPresencePeerCount } = options;

  useEffect(() => {
    if (!enabled) {
      setPresencePeerCount(0);
      return;
    }

    setPresencePeerCount(0);

    const clientId = getOrCreatePresenceClientId();
    if (!clientId) return;

    let cancelled = false;
    let hbTimer: number | null = null;
    let pollTimer: number | null = null;

    const beat = () => {
      if (!cancelled && document.visibilityState !== "hidden") {
        void postPresenceHeartbeat(activeSpaceId, clientId);
      }
    };

    const poll = async () => {
      if (cancelled || document.visibilityState === "hidden") return;
      const n = await fetchSpacePresencePeers(activeSpaceId, clientId);
      if (!cancelled) setPresencePeerCount(n);
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
  }, [enabled, activeSpaceId, setPresencePeerCount]);
}

/** Plan / collab docs alias — same as {@link useHeartgardenPresenceHeartbeat}. */
export { useHeartgardenPresenceHeartbeat as usePresenceHeartbeat };
