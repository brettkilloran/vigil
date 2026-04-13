import { getHeartgardenRealtimePublishMetricsSnapshot } from "@/src/lib/heartgarden-realtime-publish-metrics";

/**
 * In-process Redis publish timing (best-effort; resets per serverless instance).
 * Does not expose secrets. Useful for local/staging; production may prefer external APM.
 */
export async function GET() {
  return Response.json({
    ok: true,
    publisher: getHeartgardenRealtimePublishMetricsSnapshot(),
  });
}
