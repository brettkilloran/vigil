/**
 * Streamable HTTP MCP transport validates Accept (see @modelcontextprotocol/sdk
 * streamableHttp). Browsers and some connectors omit it; merge defaults without
 * dropping client preferences.
 */
export function mergeStreamableHttpAcceptHeader(
  method: string,
  acceptHeader: string | null
): string {
  const accept = (acceptHeader ?? "").trim();
  let merged = accept;

  if (method === "GET") {
    if (!merged.includes("text/event-stream")) {
      merged = merged ? `${merged}, text/event-stream` : "text/event-stream";
    }
  } else if (method === "POST") {
    if (!merged.includes("application/json")) {
      merged = merged ? `${merged}, application/json` : "application/json";
    }
    if (!merged.includes("text/event-stream")) {
      merged = `${merged}, text/event-stream`;
    }
  }

  return merged;
}
