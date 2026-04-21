"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

import {
  fetchSpacePresencePeersDetail,
  leavePresenceBeacon,
  postPresencePayload,
  type SpacePresencePeer,
} from "@/src/components/foundation/architectural-neon-api";
import {
  HEARTGARDEN_PRESENCE_HEARTBEAT_MS,
  HEARTGARDEN_PRESENCE_PEER_POLL_MS,
} from "@/src/lib/heartgarden-collab-constants";
import type { PresenceSigilVariant } from "@/src/lib/collab-presence-identity";
import { getOrCreatePresenceClientId } from "@/src/lib/heartgarden-presence-client";
import type { CameraState } from "@/src/model/canvas-types";

export type { SpacePresencePeer };

/**
 * Presence heartbeat + peer poll. Split into two effects so that "leave" signals
 * (tab close, collab disable, component unmount) are decoupled from the heartbeat loop:
 *
 * - **Heartbeat effect** keyed on `[enabled, activeSpaceId]` — runs the 25s beat and 3s poll,
 *   restarts them on space switches. Deliberately does **not** fire a DELETE on cleanup,
 *   because an SPA space change re-runs this effect and a racing DELETE could land *after*
 *   the new effect's immediate POST, wiping the freshly upserted row.
 *
 * - **Leave-signal effect** keyed on `[enabled]` — owns the `pagehide` listener and the
 *   unmount/disable DELETE. Because its deps do not include `activeSpaceId`, changing space
 *   in the SPA does **not** retrigger this cleanup, so no DELETE/POST race exists. A
 *   `spaceIdRef` carries the latest space id into the beacon.
 */
export function useHeartgardenPresenceHeartbeat(options: {
  enabled: boolean;
  activeSpaceId: string;
  getPayload: () => { camera: CameraState; pointer: { x: number; y: number } | null };
  getIdentity?: () => { displayName: string | null; sigil: PresenceSigilVariant | null };
  onPeersUpdate: (peers: SpacePresencePeer[]) => void;
}): void {
  const { enabled, activeSpaceId, getPayload, getIdentity, onPeersUpdate } = options;
  const getPayloadRef = useRef(getPayload);
  const getIdentityRef = useRef(getIdentity);
  const onPeersRef = useRef(onPeersUpdate);
  const spaceIdRef = useRef(activeSpaceId);
  useLayoutEffect(() => {
    getPayloadRef.current = getPayload;
    getIdentityRef.current = getIdentity;
    onPeersRef.current = onPeersUpdate;
    spaceIdRef.current = activeSpaceId;
  }, [activeSpaceId, getIdentity, getPayload, onPeersUpdate]);

  // Leave-signal effect. Registers `pagehide` once per enabled-session and fires a DELETE
  // on unmount or when `enabled` flips false so peers stop seeing us before TTL prune.
  // Deliberately *not* guarding against duplicate fires: the `pagehide(persisted=true)` →
  // bfcache → `pageshow` cycle legitimately re-POSTs presence on return, and a later real
  // tab-close must be allowed to DELETE again. Server DELETE is idempotent and the rate-limit
  // cost of an occasional double-fire is negligible (one token per tab close).
  useEffect(() => {
    if (!enabled) return;
    const clientId = getOrCreatePresenceClientId();
    if (!clientId) return;

    const fireLeave = () => {
      leavePresenceBeacon(spaceIdRef.current, clientId);
    };

    const onPageHide = () => fireLeave();
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      fireLeave();
    };
  }, [enabled]);

  // Heartbeat + peer poll effect.
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
      const identity = getIdentityRef.current?.() ?? undefined;
      void postPresencePayload(activeSpaceId, clientId, {
        ...p,
        displayName: identity?.displayName ?? undefined,
        sigil: identity?.sigil ?? undefined,
      });
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
      // Covers bfcache return (`pageshow` is mirrored by a visibilitychange to "visible")
      // — restart timers and re-post so we are not invisible to peers while back.
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
