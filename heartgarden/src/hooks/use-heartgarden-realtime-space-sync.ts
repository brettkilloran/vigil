"use client";

import { useEffect, useRef } from "react";

import {
  installHeartgardenCollabMetricsGlobal,
  recordRealtimeMessageReceived,
  recordRealtimeWsConnect,
  recordRealtimeWsDisconnect,
} from "@/src/lib/heartgarden-collab-metrics";

export function useHeartgardenRealtimeSpaceSync(options: {
  enabled: boolean;
  activeSpaceId: string;
  onInvalidate: () => void;
}): { connectedRef: React.MutableRefObject<boolean> } {
  const { enabled, activeSpaceId, onInvalidate } = options;
  const connectedRef = useRef(false);

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

    const clearReconnect = () => {
      if (reconnectTimer != null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const scheduleReconnect = () => {
      if (closed || reconnectTimer != null) return;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        void connect();
      }, 2000);
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
          connectedRef.current = true;
          recordRealtimeWsConnect();
        };
        ws.onmessage = () => {
          recordRealtimeMessageReceived();
          onInvalidate();
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
  }, [enabled, activeSpaceId, onInvalidate]);

  return { connectedRef };
}
