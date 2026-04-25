export const HEARTGARDEN_REALTIME_WS_PROTOCOL = "heartgarden.realtime.v1";

export function heartgardenRealtimeSocketProtocols(token: string): string[] {
  const trimmed = token.trim();
  if (!trimmed) {
    return [HEARTGARDEN_REALTIME_WS_PROTOCOL];
  }
  return [HEARTGARDEN_REALTIME_WS_PROTOCOL, `auth.${trimmed}`];
}

export function heartgardenRealtimeTokenFromProtocolsHeader(
  headerValue: string | string[] | undefined
): string | null {
  const raw = Array.isArray(headerValue) ? headerValue.join(",") : headerValue;
  if (!raw) {
    return null;
  }
  const parts = raw
    .split(",")
    .map((s) => s.trim().replace(/^"+|"+$/g, ""))
    .filter(Boolean);
  for (const p of parts) {
    if (p.startsWith("auth.") && p.length > "auth.".length) {
      return p.slice("auth.".length);
    }
  }
  return null;
}
