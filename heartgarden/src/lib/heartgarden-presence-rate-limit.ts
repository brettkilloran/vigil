import { isPlaywrightE2E } from "@/src/lib/heartgarden-boot-session";

type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();
let pruneCounter = 0;

/**
 * Default budget: one POST every ~25s per tab ≈ 36 requests / 15 min / tab.
 * Everyone on the same home Wi‑Fi (or any shared NAT) shares one public IP, so counts add:
 * e.g. two household players ≈ 72 posts / 15 min — far below default. Default allows
 * ~110 steady tabs per public IP per window before 429.
 */
const DEFAULT_PRESENCE_POST_MAX = 4000;
const PRESENCE_POST_MAX_CLAMP = 100_000;

function readPresencePostRateLimitConfig(): { max: number; windowMs: number } {
  const maxRaw = Number.parseInt(
    (process.env.HEARTGARDEN_PRESENCE_POST_RATE_LIMIT_MAX ?? "").trim(),
    10
  );
  const windowRaw = Number.parseInt(
    (process.env.HEARTGARDEN_PRESENCE_POST_RATE_LIMIT_WINDOW_MS ?? "").trim(),
    10
  );
  const max =
    Number.isFinite(maxRaw) && maxRaw >= 10
      ? Math.min(maxRaw, PRESENCE_POST_MAX_CLAMP)
      : DEFAULT_PRESENCE_POST_MAX;
  const windowMs =
    Number.isFinite(windowRaw) && windowRaw >= 60_000
      ? Math.min(windowRaw, 3_600_000)
      : 15 * 60 * 1000;
  return { max, windowMs };
}

function pruneStaleBuckets(windowMs: number) {
  const now = Date.now();
  const cutoff = now - windowMs * 2;
  for (const [ip, b] of buckets) {
    if (b.windowStart < cutoff) {
      buckets.delete(ip);
    }
  }
}

/**
 * In-memory per-instance limit for presence heartbeats. Not a security boundary.
 */
export function consumeHeartgardenPresencePostRateLimit(ip: string): boolean {
  if (isPlaywrightE2E()) {
    return true;
  }
  const { max, windowMs } = readPresencePostRateLimitConfig();
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
