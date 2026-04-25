/**
 * Best-effort in-memory rate limit for POST /api/lore/query.
 * On serverless, each instance has its own Map; use Redis / Vercel KV for strict global limits.
 */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 24;

type Bucket = { windowStart: number; count: number };

const buckets = new Map<string, Bucket>();

function clientKeyFromRequest(req: Request): string {
  const h = req.headers;
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return `ip:${first}`;
    }
  }
  const realIp = h.get("x-real-ip")?.trim();
  if (realIp) {
    return `ip:${realIp}`;
  }
  return "ip:unknown";
}

export function loreQueryRateLimitExceeded(req: Request): boolean {
  const key = clientKeyFromRequest(req);
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now - b.windowStart >= WINDOW_MS) {
    b = { windowStart: now, count: 0 };
    buckets.set(key, b);
  }
  b.count += 1;
  if (b.count > MAX_PER_WINDOW) {
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
