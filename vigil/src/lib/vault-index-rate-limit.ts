/**
 * In-memory rate limit for vault index / reindex POST routes (serverless: per-instance).
 */

const WINDOW_MS = 60_000;
const MAX_INDEX_PER_WINDOW = 40;
const MAX_REINDEX_PER_WINDOW = 4;

type Bucket = { windowStart: number; count: number };

const indexBuckets = new Map<string, Bucket>();
const reindexBuckets = new Map<string, Bucket>();

function clientKeyFromRequest(req: Request): string {
  const h = req.headers;
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return `ip:${first}`;
  }
  const realIp = h.get("x-real-ip")?.trim();
  if (realIp) return `ip:${realIp}`;
  return "ip:unknown";
}

function bump(map: Map<string, Bucket>, key: string, max: number): boolean {
  const now = Date.now();
  let b = map.get(key);
  if (!b || now - b.windowStart >= WINDOW_MS) {
    b = { windowStart: now, count: 0 };
    map.set(key, b);
  }
  b.count += 1;
  if (map.size > 10_000) {
    for (const [k, v] of map) {
      if (now - v.windowStart >= WINDOW_MS) map.delete(k);
    }
  }
  return b.count > max;
}

/** @returns true if rate limited */
export function vaultItemIndexRateLimitExceeded(req: Request): boolean {
  return bump(indexBuckets, clientKeyFromRequest(req), MAX_INDEX_PER_WINDOW);
}

/** @returns true if rate limited */
export function vaultSpaceReindexRateLimitExceeded(req: Request): boolean {
  return bump(reindexBuckets, clientKeyFromRequest(req), MAX_REINDEX_PER_WINDOW);
}
