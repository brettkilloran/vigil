/**
 * Best-effort in-memory rate limit for GET /api/search.
 * On serverless each instance has its own map; use Redis/KV for strict global limits.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 120;

type Bucket = { windowStart: number; count: number };
const buckets = new Map<string, Bucket>();

function searchClientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return `ip:${first}`;
    }
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return `ip:${realIp}`;
  }
  return "ip:unknown";
}

export function searchRateLimitExceeded(req: Request): boolean {
  const key = searchClientKey(req);
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    bucket = { windowStart: now, count: 0 };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > MAX_PER_WINDOW) {
    return true;
  }
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) {
      if (now - v.windowStart >= WINDOW_MS) {
        buckets.delete(k);
      }
    }
  }
  return false;
}
