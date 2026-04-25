import { createServer, type IncomingMessage } from "node:http";
import { resolve } from "node:path";
import { URL } from "node:url";

import { config } from "dotenv";
import { createClient } from "redis";
import { type WebSocket, WebSocketServer } from "ws";

import {
  heartgardenRealtimeRedisUrlFromEnv,
  heartgardenRealtimeSecretFromEnv,
  heartgardenRealtimeSpaceChannel,
} from "../src/lib/heartgarden-realtime-config";
import {
  heartgardenRealtimeTokenFromProtocolsHeader,
  verifyHeartgardenRealtimeRoomToken,
} from "../src/lib/heartgarden-realtime-token";

config({ path: resolve(process.cwd(), ".env.local") });

const port = Number.parseInt(
  process.env.HEARTGARDEN_REALTIME_PORT ?? "3002",
  10
);
const redisUrl = heartgardenRealtimeRedisUrlFromEnv();
const realtimeSecret = heartgardenRealtimeSecretFromEnv();

if (!redisUrl) {
  throw new Error(
    "HEARTGARDEN_REALTIME_REDIS_URL is required for realtime-server"
  );
}
if (realtimeSecret.length < 16) {
  throw new Error("HEARTGARDEN_REALTIME_SECRET must be at least 16 characters");
}

const metrics = {
  wsConnectionsAccepted: 0,
  wsConnectionsClosed: 0,
  redisMessagesReceived: 0,
  fanoutSendCalls: 0,
  /** Last N fanout durations (Redis callback → socket.send), ms */
  fanoutMsRecent: [] as number[],
};

const MAX_FANOUT_SAMPLES = 50;

function recordFanoutMs(ms: number) {
  metrics.fanoutMsRecent.push(ms);
  while (metrics.fanoutMsRecent.length > MAX_FANOUT_SAMPLES) {
    metrics.fanoutMsRecent.shift();
  }
}

function fanoutStats() {
  const arr = [...metrics.fanoutMsRecent].sort((a, b) => a - b);
  const p = (q: number) =>
    arr.length === 0
      ? null
      : arr[Math.min(arr.length - 1, Math.floor(q * (arr.length - 1)))];
  return {
    count: arr.length,
    lastMs: arr.length ? arr.at(-1)! : null,
    p50Ms: p(0.5),
    p95Ms: p(0.95),
  };
}

const server = createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (req.url === "/metrics" || req.url?.startsWith("/metrics?")) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        rooms: roomMap.size,
        wsConnectionsAccepted: metrics.wsConnectionsAccepted,
        wsConnectionsClosed: metrics.wsConnectionsClosed,
        redisMessagesReceived: metrics.redisMessagesReceived,
        fanoutSendCalls: metrics.fanoutSendCalls,
        fanout: fanoutStats(),
      })
    );
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ noServer: true });
const subscriber = createClient({ url: redisUrl });

subscriber.on("error", () => {
  // Keep process alive; reconnect behavior is handled by the Redis client.
});

interface RoomState {
  sockets: Set<WebSocket>;
  subscribed: boolean;
}

const roomMap = new Map<string, RoomState>();

async function ensureSubscribed(spaceId: string) {
  const channel = heartgardenRealtimeSpaceChannel(spaceId);
  const room = roomMap.get(spaceId);
  if (!room || room.subscribed) {
    return;
  }
  await subscriber.subscribe(channel, (message) => {
    const t0 = performance.now();
    metrics.redisMessagesReceived += 1;
    const currentRoom = roomMap.get(spaceId);
    if (!currentRoom) {
      return;
    }
    for (const socket of currentRoom.sockets) {
      if (socket.readyState === socket.OPEN) {
        socket.send(message);
        metrics.fanoutSendCalls += 1;
      }
    }
    recordFanoutMs(performance.now() - t0);
  });
  room.subscribed = true;
}

async function maybeUnsubscribe(spaceId: string) {
  const room = roomMap.get(spaceId);
  if (!room || room.sockets.size > 0 || !room.subscribed) {
    return;
  }
  await subscriber.unsubscribe(heartgardenRealtimeSpaceChannel(spaceId));
  roomMap.delete(spaceId);
}

wss.on(
  "connection",
  (ws: WebSocket, _request: IncomingMessage, tokenSpaceId: string) => {
    metrics.wsConnectionsAccepted += 1;
    let room = roomMap.get(tokenSpaceId);
    if (!room) {
      room = { sockets: new Set(), subscribed: false };
      roomMap.set(tokenSpaceId, room);
    }
    room.sockets.add(ws);
    void ensureSubscribed(tokenSpaceId);

    ws.on("close", () => {
      metrics.wsConnectionsClosed += 1;
      const currentRoom = roomMap.get(tokenSpaceId);
      if (!currentRoom) {
        return;
      }
      currentRoom.sockets.delete(ws);
      void maybeUnsubscribe(tokenSpaceId);
    });

    ws.on("message", () => {
      // Server is push-only today.
    });

    ws.send(
      JSON.stringify({
        type: "realtime.connected",
        spaceId: tokenSpaceId,
        at: new Date().toISOString(),
      })
    );
  }
);

server.on("upgrade", (request, socket, head) => {
  const baseUrl = `http://${request.headers.host ?? "localhost"}`;
  const url = new URL(request.url ?? "/", baseUrl);
  const protocolToken = heartgardenRealtimeTokenFromProtocolsHeader(
    request.headers["sec-websocket-protocol"]
  );
  // Backward-compatible fallback while clients roll from query-string auth.
  const token = protocolToken ?? url.searchParams.get("token") ?? "";
  const verified = verifyHeartgardenRealtimeRoomToken(token);
  if (!verified) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request, verified.spaceId);
  });
});

await subscriber.connect();
server.listen(port, () => {
  console.log(`heartgarden realtime server listening on :${port}`);
});
