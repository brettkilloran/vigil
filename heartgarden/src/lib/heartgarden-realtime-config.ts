export const HEARTGARDEN_REALTIME_CHANNEL_PREFIX =
  "heartgarden:realtime:space:";

function readNonEmptyEnv(name: string): string {
  return (process.env[name] ?? "").trim();
}

export function heartgardenRealtimePublicUrlFromEnv(): string {
  return readNonEmptyEnv("HEARTGARDEN_REALTIME_URL");
}

export function heartgardenRealtimeRedisUrlFromEnv(): string {
  return readNonEmptyEnv("HEARTGARDEN_REALTIME_REDIS_URL");
}

export function heartgardenRealtimeSecretFromEnv(): string {
  return readNonEmptyEnv("HEARTGARDEN_REALTIME_SECRET");
}

export function isHeartgardenRealtimeConfigured(): boolean {
  return (
    heartgardenRealtimePublicUrlFromEnv().length > 0 &&
    heartgardenRealtimeRedisUrlFromEnv().length > 0 &&
    heartgardenRealtimeSecretFromEnv().length >= 16
  );
}

export function isHeartgardenRealtimePublisherConfigured(): boolean {
  return (
    heartgardenRealtimeRedisUrlFromEnv().length > 0 &&
    heartgardenRealtimeSecretFromEnv().length >= 16
  );
}

export function heartgardenRealtimeSpaceChannel(spaceId: string): string {
  return `${HEARTGARDEN_REALTIME_CHANNEL_PREFIX}${spaceId}`;
}
