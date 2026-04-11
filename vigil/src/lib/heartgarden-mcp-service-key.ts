/**
 * Shared validation for HEARTGARDEN_MCP_SERVICE_KEY (Edge-safe, no Node-only APIs).
 * Used by middleware and API route handlers so MCP and server-to-server fetches can
 * pass the boot gate without hg_boot cookies.
 */

export function heartgardenMcpServiceKeyFromEnv(): string {
  return (process.env.HEARTGARDEN_MCP_SERVICE_KEY ?? "").trim();
}

/** Constant-time comparison of UTF-8 bytes (both environments). */
export function timingSafeEqualUtf8(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let x = 0;
  for (let i = 0; i < ab.length; i++) x |= ab[i]! ^ bb[i]!;
  return x === 0;
}

/**
 * True if Authorization is "Bearer <token>" and token matches HEARTGARDEN_MCP_SERVICE_KEY.
 */
export function authorizationBearerMatchesMcpServiceKey(authorization: string | null | undefined): boolean {
  const key = heartgardenMcpServiceKeyFromEnv();
  if (!key.length) return false;
  const raw = (authorization ?? "").trim();
  const m = /^Bearer\s+(\S+)$/i.exec(raw);
  if (!m) return false;
  return timingSafeEqualUtf8(m[1]!, key);
}
