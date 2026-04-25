import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { NextRequest } from "next/server";

import {
  heartgardenMcpServiceKeyFromEnv,
  mcpRequestAuthorizedByServiceKey,
} from "@/src/lib/heartgarden-mcp-service-key";
import {
  createHeartgardenMcpServer,
  resolveHeartgardenMcpBaseUrl,
} from "@/src/lib/mcp/heartgarden-mcp-server";
import { isLikelyBrowserDocumentNavigation } from "@/src/lib/mcp/mcp-http-browser-navigation";
import { mergeStreamableHttpAcceptHeader } from "@/src/lib/mcp/mcp-streamable-http-accept";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

const MCP_BROWSER_INFO_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Heartgarden MCP</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; color: #e8e6e3; background: #14120f; }
  code { background: #2a2620; padding: 0.15rem 0.35rem; border-radius: 4px; font-size: 0.9em; }
  h1 { font-size: 1.25rem; font-weight: 600; }
  p { margin: 0.75rem 0; }
</style>
</head>
<body>
<h1>Heartgarden MCP endpoint</h1>
<p>This URL is a <strong>Model Context Protocol</strong> transport for Claude and other MCP clients. It is not a regular web page, so you will not see app UI here.</p>
<p>Add the same URL in <strong>Claude → Customize → Connectors</strong> (or Desktop settings) to use tools against your space.</p>
<p>If you saw a JSON error mentioning <code>not_found_error</code> or <code>Server not found</code> with a Claude <code>request_id</code>, that message came from <strong>Anthropic’s systems</strong>, not from Heartgarden. Our API returns JSON-RPC (<code>jsonrpc: "2.0"</code>) errors when something fails here.</p>
</body>
</html>`;

function requestWithStreamableHttpAccept(request: NextRequest): Request {
  const raw = request.headers.get("accept");
  const merged = mergeStreamableHttpAcceptHeader(request.method, raw);
  if (merged === (raw ?? "").trim()) {
    return request;
  }
  const headers = new Headers(request.headers);
  headers.set("accept", merged);
  const init: RequestInit & { duplex?: "half" } = {
    body: request.body,
    headers,
    method: request.method,
    signal: request.signal ?? undefined,
  };
  if (request.body) {
    init.duplex = "half";
  }
  return new Request(request.url, init);
}

async function handleMcpRequest(request: NextRequest): Promise<Response> {
  if (!heartgardenMcpServiceKeyFromEnv()) {
    return new Response(
      JSON.stringify({
        error: "HEARTGARDEN_MCP_SERVICE_KEY is not configured on the server.",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 503,
      }
    );
  }
  if (!mcpRequestAuthorizedByServiceKey(request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      headers: { "Content-Type": "application/json" },
      status: 401,
    });
  }

  if (isLikelyBrowserDocumentNavigation(request)) {
    return new Response(MCP_BROWSER_INFO_HTML, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
      },
      status: 200,
    });
  }

  const baseUrl = resolveHeartgardenMcpBaseUrl(request);
  const serviceKey = heartgardenMcpServiceKeyFromEnv();

  const server = createHeartgardenMcpServer({
    baseUrl,
    defaultSpaceId: (process.env.HEARTGARDEN_DEFAULT_SPACE_ID ?? "").trim(),
    gmBreakGlass:
      (process.env.HEARTGARDEN_GM_ALLOW_PLAYER_SPACE ?? "").trim() === "1",
    playerSpaceExcluded: (process.env.HEARTGARDEN_PLAYER_SPACE_ID ?? "")
      .trim()
      .toLowerCase(),
    readOnly: (process.env.HEARTGARDEN_MCP_READ_ONLY ?? "").trim() === "1",
    serviceKey,
    writeKey: (process.env.HEARTGARDEN_MCP_WRITE_KEY ?? "").trim(),
  });

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  await server.connect(transport);
  return transport.handleRequest(requestWithStreamableHttpAccept(request));
}

// biome-ignore lint/suspicious/useAwait: Next.js Route Handler signatures must be async even when no await is needed.
export async function GET(request: NextRequest) {
  return handleMcpRequest(request);
}

// biome-ignore lint/suspicious/useAwait: Next.js Route Handler signatures must be async even when no await is needed.
export async function POST(request: NextRequest) {
  return handleMcpRequest(request);
}

// biome-ignore lint/suspicious/useAwait: Next.js Route Handler signatures must be async even when no await is needed.
export async function DELETE(request: NextRequest) {
  return handleMcpRequest(request);
}
