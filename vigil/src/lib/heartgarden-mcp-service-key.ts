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
 * Read ?token= / ?key= from a request URL string.
 * Next.js often passes **path-only** `request.url` (e.g. `/api/mcp?token=...`); `new URL()` throws on that
 * without a base, so we must parse the query substring explicitly.
 */
export function mcpTokenFromRequestUrlString(urlString: string): string | null {
  const qi = urlString.indexOf("?");
  if (qi !== -1) {
    const sp = new URLSearchParams(urlString.slice(qi + 1));
    return sp.get("token") ?? sp.get("key");
  }
  try {
    const u = new URL(urlString);
    return u.searchParams.get("token") ?? u.searchParams.get("key");
  } catch {
    return null;
  }
}

function tokenFromNextRequestIfPresent(request: Request): string | null {
  const r = request as Request & { nextUrl?: { searchParams: URLSearchParams } };
  if (r.nextUrl?.searchParams) {
    return r.nextUrl.searchParams.get("token") ?? r.nextUrl.searchParams.get("key");
  }
  return null;
}

/**
 * Same secret as Bearer, for clients that only support pasting a URL (e.g. Claude custom connector):
 * `?token=` or `?key=` on /api/mcp, or header `X-Heartgarden-Mcp-Token`.
 * Prefer Bearer when possible — query strings can appear in access logs.
 */
export function mcpUrlQueryOrHeaderMatchesServiceKey(request: Request): boolean {
  const key = heartgardenMcpServiceKeyFromEnv();
  if (!key.length) return false;

  const fromNext = tokenFromNextRequestIfPresent(request);
  if (fromNext && timingSafeEqualUtf8(fromNext.trim(), key)) return true;

  const fromUrl = mcpTokenFromRequestUrlString(request.url);
  if (fromUrl && timingSafeEqualUtf8(fromUrl.trim(), key)) return true;

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
