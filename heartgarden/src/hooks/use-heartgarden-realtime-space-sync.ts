"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

import {
  installHeartgardenCollabMetricsGlobal,
  recordRealtimeMessageReceived,
  recordRealtimeWsConnect,
  recordRealtimeWsDisconnect,
} from "@/src/lib/heartgarden-collab-metrics";
import { heartgardenRealtimeSocketProtocols } from "@/src/lib/heartgarden-realtime-protocol";

export function useHeartgardenRealtimeSpaceSync(options: {
  enabled: boolean;
  activeSpaceId: string;
  /** Payload from Redis fanout; use `reason === "item-links.changed"` to refresh graph without waiting for poll. */
  onInvalidate: (detail?: { reason?: string }) => void;
}): { connectedRef: React.MutableRefObject<boolean> } {
  const { enabled, activeSpaceId, onInvalidate } = options;
  const connectedRef = useRef(false);
  const onInvalidateRef = useRef(onInvalidate);
  useLayoutEffect(() => {
    onInvalidateRef.current = onInvalidate;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      installHeartgardenCollabMetricsGlobal();
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      connectedRef.current = false;
      return;
    }

    let closed = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let reconnectAttempt = 0;
    // REVIEW_2026-04-22-2 H7: abort in-flight token fetch on cleanup and guard
    // each await boundary against `closed` so a stale async resume cannot create
    // a websocket for a space we've already switched away from.
    const tokenAbort = new AbortController();

    const clearReconnect = () => {
      if (reconnectTimer != null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const scheduleReconnect = () => {
      if (closed || reconnectTimer != null) {
        return;
      }
      const base = Math.min(30_000, 2000 * 2 ** reconnectAttempt);
      reconnectAttempt += 1;
      const jitterMs = base * (0.7 + Math.random() * 0.6);
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        if (closed) {
          return;
        }
        void connect();
      }, jitterMs);
    };

    const connect = async () => {
      if (closed) {
        return;
      }
      try {
        const tokenRes = await fetch("/api/realtime/room-token", {
          body: JSON.stringify({ spaceId: activeSpaceId }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
          signal: tokenAbort.signal,
        });
        if (closed) {
          return;
        }
        const tokenJson = (await tokenRes.json()) as {
          ok?: boolean;
          realtimeUrl?: string;
          token?: string;
          error?: string;
        };
        if (closed) {
          return;
        }
        if (
          !tokenRes.ok ||
          tokenJson.ok !== true ||
          !tokenJson.realtimeUrl ||
          !tokenJson.token
        ) {
          connectedRef.current = false;
          if (
            tokenRes.status === 503 ||
            tokenJson.error === "Realtime not configured"
          ) {
            return;
          }
          scheduleReconnect();
          return;
        }
        const nextWs = new WebSocket(
          tokenJson.realtimeUrl,
          heartgardenRealtimeSocketProtocols(tokenJson.token)
        );
        if (closed) {
          // Late cleanup after token fetch resolved: close before assigning so the
          // outer cleanup's `ws?.close()` would have been a no-op otherwise.
          try {
            nextWs.close();
          } catch {
            /* ignore */
          }
          return;
        }
        ws = nextWs;
        ws.onopen = () => {
          reconnectAttempt = 0;
          connectedRef.current = true;
          recordRealtimeWsConnect();
        };
        ws.onmessage = (ev) => {
          if (closed) {
            return;
          }
          recordRealtimeMessageReceived();
          let reason: string | undefined;
          try {
            const p = JSON.parse(String(ev.data)) as { reason?: string };
            if (typeof p.reason === "string") {
              reason = p.reason;
            }
          } catch {
            /* ignore */
          }
          onInvalidateRef.current(
            reason === undefined ? undefined : { reason }
          );
        };
        ws.onerror = () => {
          connectedRef.current = false;
        };
        ws.onclose = () => {
          connectedRef.current = false;
          recordRealtimeWsDisconnect();
          if (!closed) {
            scheduleReconnect();
          }
        };
      } catch (err) {
        if (closed) {
          return;
        }
        // AbortError from cleanup-triggered abort: treat as normal shutdown.
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        connectedRef.current = false;
        scheduleReconnect();
      }
    };

    void connect();

    return () => {
      closed = true;
      connectedRef.current = false;
      clearReconnect();
      try {
        tokenAbort.abort();
      } catch {
        /* ignore */
      }
      ws?.close();
    };
  }, [enabled, activeSpaceId]);

  return { connectedRef };
}
