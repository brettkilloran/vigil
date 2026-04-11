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

/**
 * Same secret as Bearer, for clients that only support pasting a URL (e.g. Claude custom connector):
 * `?token=` or `?key=` on /api/mcp, or header `X-Heartgarden-Mcp-Token`.
 * Prefer Bearer when possible — query strings can appear in access logs.
 */
export function mcpUrlQueryOrHeaderMatchesServiceKey(request: Request): boolean {
  const key = heartgardenMcpServiceKeyFromEnv();
  if (!key.length) return false;
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("token") ?? url.searchParams.get("key");
    if (q && timingSafeEqualUtf8(q.trim(), key)) return true;
  } catch {
    /* invalid URL */
  }
  const h = request.headers.get("x-heartgarden-mcp-token");
  if (h && timingSafeEqualUtf8(h.trim(), key)) return true;
  return false;
}

/** Bearer, or URL query token/key, or X-Heartgarden-Mcp-Token header. */
export function mcpRequestAuthorizedByServiceKey(request: Request): boolean {
  return (
    authorizationBearerMatchesMcpServiceKey(request.headers.get("authorization")) ||
    mcpUrlQueryOrHeaderMatchesServiceKey(request)
  );
}
