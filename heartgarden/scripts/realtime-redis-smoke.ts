/**
 * Quick check: Redis reachable with HEARTGARDEN_REALTIME_REDIS_URL from .env.local.
 * Usage: pnpm exec tsx ./scripts/realtime-redis-smoke.ts
 */

import { resolve } from "node:path";
import { config } from "dotenv";
import { createClient } from "redis";

config({ path: resolve(process.cwd(), ".env.local") });

const url = process.env.HEARTGARDEN_REALTIME_REDIS_URL?.trim();
if (!url) {
  console.error(
    "Missing HEARTGARDEN_REALTIME_REDIS_URL in .env.local (or empty)."
  );
  process.exit(1);
}

async function main() {
  const client = createClient({ url });
  client.on("error", (err) => {
    console.error("Redis client error:", err.message);
  });

  try {
    await client.connect();
    const pong = await client.ping();
    await client.quit();
    console.log("OK: Redis PING returned", JSON.stringify(pong));
    process.exit(0);
  } catch (e) {
    console.error("FAIL: could not connect or PING Redis.");
    console.error(e instanceof Error ? e.message : e);
    try {
      await client.quit();
    } catch {
      /* ignore */
    }
    process.exit(1);
  }
}

void main();
