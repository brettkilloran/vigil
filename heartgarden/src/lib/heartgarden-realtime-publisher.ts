import { createClient } from "redis";

import { heartgardenRealtimeRedisUrlFromEnv, heartgardenRealtimeSpaceChannel } from "@/src/lib/heartgarden-realtime-config";
import { recordHeartgardenRealtimePublishMs } from "@/src/lib/heartgarden-realtime-publish-metrics";

export type HeartgardenRealtimeEvent = {
  type: "space.invalidate";
  spaceId: string;
  originSpaceId: string;
  reason:
    | "item.created"
    | "item.updated"
    | "item.deleted"
    | "space.created"
    | "space.updated"
    | "space.deleted"
    | "space.moved"
    | "item-links.changed";
  itemId?: string;
  spaceIds?: string[];
  updatedAt: string;
};

type HeartgardenRealtimeRedisClient = ReturnType<typeof createClient>;

let redisClientPromise: Promise<HeartgardenRealtimeRedisClient | null> | null = null;

async function getRealtimeRedisClient(): Promise<HeartgardenRealtimeRedisClient | null> {
  const url = heartgardenRealtimeRedisUrlFromEnv();
  if (!url) return null;
  if (!redisClientPromise) {
    redisClientPromise = (async () => {
      const client = createClient({ url });
      client.on("error", () => {
        // Best-effort publisher; request handlers should not fail because fanout is unavailable.
      });
      await client.connect();
      return client;
    })().catch(() => null);
  }
  return redisClientPromise;
}

export async function publishHeartgardenRealtimeEvent(
  event: HeartgardenRealtimeEvent,
): Promise<void> {
  const client = await getRealtimeRedisClient();
  if (!client) return;
  const spaceIds = new Set<string>([event.spaceId, ...(event.spaceIds ?? [])]);
  const payload = JSON.stringify(event);
  const t0 = performance.now();
  await Promise.all(
    [...spaceIds].map((spaceId) =>
      client.publish(heartgardenRealtimeSpaceChannel(spaceId), payload),
    ),
  );
  recordHeartgardenRealtimePublishMs(performance.now() - t0);
}
