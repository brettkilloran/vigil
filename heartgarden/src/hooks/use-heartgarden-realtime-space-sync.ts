"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

import {
  installHeartgardenCollabMetricsGlobal,
  recordRealtimeMessageReceived,
  recordRealtimeWsConnect,
  recordRealtimeWsDisconnect,
} from "@/src/lib/heartgarden-collab-metrics";

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

    const clearReconnect = () => {
      if (reconnectTimer != null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const scheduleReconnect = () => {
      if (closed || reconnectTimer != null) return;
      const base = Math.min(30_000, 2000 * Math.pow(2, reconnectAttempt));
      reconnectAttempt += 1;
      const jitterMs = base * (0.7 + Math.random() * 0.6);
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        void connect();
      }, jitterMs);
    };

    const connect = async () => {
      try {
        const tokenRes = await fetch("/api/realtime/room-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ spaceId: activeSpaceId }),
        });
        const tokenJson = (await tokenRes.json()) as {
          ok?: boolean;
          realtimeUrl?: string;
          token?: string;
          error?: string;
        };
        if (!tokenRes.ok || tokenJson.ok !== true || !tokenJson.realtimeUrl || !tokenJson.token) {
          connectedRef.current = false;
          if (tokenRes.status === 503 || tokenJson.error === "Realtime not configured") {
            return;
          }
          scheduleReconnect();
          return;
        }
        ws = new WebSocket(`${tokenJson.realtimeUrl}?token=${encodeURIComponent(tokenJson.token)}`);
        ws.onopen = () => {
          reconnectAttempt = 0;
          connectedRef.current = true;
          recordRealtimeWsConnect();
        };
        ws.onmessage = (ev) => {
          recordRealtimeMessageReceived();
          let reason: string | undefined;
          try {
            const p = JSON.parse(String(ev.data)) as { reason?: string };
            if (typeof p.reason === "string") reason = p.reason;
          } catch {
            /* ignore */
          }
          onInvalidateRef.current(reason !== undefined ? { reason } : undefined);
        };
        ws.onerror = () => {
          connectedRef.current = false;
        };
        ws.onclose = () => {
          connectedRef.current = false;
          recordRealtimeWsDisconnect();
          if (!closed) scheduleReconnect();
        };
      } catch {
        connectedRef.current = false;
        scheduleReconnect();
      }
    };

    void connect();

    return () => {
      closed = true;
      connectedRef.current = false;
      clearReconnect();
      ws?.close();
    };
  }, [enabled, activeSpaceId]);

  return { connectedRef };
}
