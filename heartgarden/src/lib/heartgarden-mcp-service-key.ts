/**
 * Shared validation for HEARTGARDEN_MCP_SERVICE_KEY (Edge-safe, no Node-only APIs).
 * Used by middleware and API route handlers so MCP and server-to-server fetches can
 * pass the boot gate without hg_boot cookies.
 */

import { constantTimeBytesEqual } from "@/src/lib/hash-utils";

const BEARER_AUTH_RE = /^Bearer\s+(\S+)$/i;

export function heartgardenMcpServiceKeyFromEnv(): string {
  return (process.env.HEARTGARDEN_MCP_SERVICE_KEY ?? "").trim();
}

function mcpAllowQueryTokenAuth(): boolean {
  const raw = (process.env.HEARTGARDEN_MCP_ALLOW_QUERY_TOKEN ?? "")
    .trim()
    .toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/** Constant-time comparison of UTF-8 bytes (both environments). */
export function timingSafeEqualUtf8(a: string, b: string): boolean {
  const enc = new TextEncoder();
  return constantTimeBytesEqual(enc.encode(a), enc.encode(b));
}

/**
 * True if Authorization is "Bearer <token>" and token matches HEARTGARDEN_MCP_SERVICE_KEY.
 */
export function authorizationBearerMatchesMcpServiceKey(
  authorization: string | null | undefined
): boolean {
  const key = heartgardenMcpServiceKeyFromEnv();
  if (!key.length) {
    return false;
  }
  const raw = (authorization ?? "").trim();
  const m = BEARER_AUTH_RE.exec(raw);
  if (!m) {
    return false;
  }
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
  const r = request as Request & {
    nextUrl?: { searchParams: URLSearchParams };
  };
  if (r.nextUrl?.searchParams) {
    return (
      r.nextUrl.searchParams.get("token") ?? r.nextUrl.searchParams.get("key")
    );
  }
  return null;
}

/**
 * Same secret as Bearer for alternate transports:
 * - URL query token/key (`?token=` / `?key=`) only when HEARTGARDEN_MCP_ALLOW_QUERY_TOKEN=1
 * - header `X-Heartgarden-Mcp-Token` always
 * Prefer Bearer when possible — query strings can appear in access logs/history.
 */
export function mcpUrlQueryOrHeaderMatchesServiceKey(
  request: Request
): boolean {
  const key = heartgardenMcpServiceKeyFromEnv();
  if (!key.length) {
    return false;
  }

  if (mcpAllowQueryTokenAuth()) {
    const fromNext = tokenFromNextRequestIfPresent(request);
    if (fromNext && timingSafeEqualUtf8(fromNext.trim(), key)) {
      return true;
    }

    const fromUrl = mcpTokenFromRequestUrlString(request.url);
    if (fromUrl && timingSafeEqualUtf8(fromUrl.trim(), key)) {
      return true;
    }
  }

  const h = request.headers.get("x-heartgarden-mcp-token");
  if (h && timingSafeEqualUtf8(h.trim(), key)) {
    return true;
  }
  return false;
}

/** Bearer, or X-Heartgarden-Mcp-Token, or optional query token/key when enabled. */
export function mcpRequestAuthorizedByServiceKey(request: Request): boolean {
  return (
    authorizationBearerMatchesMcpServiceKey(
      request.headers.get("authorization")
    ) || mcpUrlQueryOrHeaderMatchesServiceKey(request)
  );
}
