import { isPlaywrightE2E } from "@/src/lib/heartgarden-boot-session";

type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();
let pruneCounter = 0;

function readBootPostRateLimitConfig(): { max: number; windowMs: number } {
  const maxRaw = Number.parseInt((process.env.HEARTGARDEN_BOOT_POST_RATE_LIMIT_MAX ?? "").trim(), 10);
  const windowRaw = Number.parseInt(
    (process.env.HEARTGARDEN_BOOT_POST_RATE_LIMIT_WINDOW_MS ?? "").trim(),
    10,
  );
  const max =
    Number.isFinite(maxRaw) && maxRaw >= 3 ? Math.min(maxRaw, 500) : 40;
  const windowMs =
    Number.isFinite(windowRaw) && windowRaw >= 30_000
      ? Math.min(windowRaw, 3_600_000)
      : 15 * 60 * 1000;
  return { max, windowMs };
}

function pruneStaleBuckets(windowMs: number) {
  const now = Date.now();
  const cutoff = now - windowMs * 2;
  for (const [ip, b] of buckets) {
    if (b.windowStart < cutoff) buckets.delete(ip);
  }
}

/**
 * Client IP for rate limiting (Vercel / proxies). Not used for security-critical auth alone.
 */
export function heartgardenBootClientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

/**
 * Returns true if this POST may proceed. In-memory per-instance (serverless); still limits casual brute force.
 */
export function consumeHeartgardenBootPostRateLimit(ip: string): boolean {
  if (isPlaywrightE2E()) return true;
  const { max, windowMs } = readBootPostRateLimitConfig();
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now - b.windowStart >= windowMs) {
    buckets.set(ip, { count: 1, windowStart: now });
  } else if (b.count >= max) {
    return false;
  } else {
    b.count += 1;
  }
  pruneCounter += 1;
  if (pruneCounter >= 200) {
    pruneCounter = 0;
    pruneStaleBuckets(windowMs);
  }
  return true;
}
