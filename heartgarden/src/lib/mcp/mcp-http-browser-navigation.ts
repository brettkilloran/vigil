import type { NextRequest } from "next/server";

/**
 * True when the request looks like a user typing the URL in a browser tab.
 * Server-side MCP clients (Claude's broker, curl, mcp-remote) do not send Sec-Fetch-*.
 */
export function isLikelyBrowserDocumentNavigation(
  request: NextRequest
): boolean {
  if (request.method !== "GET") {
    return false;
  }
  const mode = request.headers.get("sec-fetch-mode");
  const dest = request.headers.get("sec-fetch-dest");
  return mode === "navigate" && dest === "document";
}
