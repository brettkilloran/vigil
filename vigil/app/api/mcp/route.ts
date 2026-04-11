import { NextRequest } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { heartgardenMcpServiceKeyFromEnv, mcpRequestAuthorizedByServiceKey } from "@/src/lib/heartgarden-mcp-service-key";
import {
  createHeartgardenMcpServer,
  resolveHeartgardenMcpBaseUrl,
} from "@/src/lib/mcp/heartgarden-mcp-server";
import { mergeStreamableHttpAcceptHeader } from "@/src/lib/mcp/mcp-streamable-http-accept";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

function requestWithStreamableHttpAccept(request: NextRequest): Request {
  const raw = request.headers.get("accept");
  const merged = mergeStreamableHttpAcceptHeader(request.method, raw);
  if (merged === (raw ?? "").trim()) {
    return request;
  }
  const headers = new Headers(request.headers);
  headers.set("accept", merged);
  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    body: request.body,
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
        status: 503,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
  if (!mcpRequestAuthorizedByServiceKey(request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const baseUrl = resolveHeartgardenMcpBaseUrl(request);
  const serviceKey = heartgardenMcpServiceKeyFromEnv();

  const server = createHeartgardenMcpServer({
    baseUrl,
    defaultSpaceId: (process.env.HEARTGARDEN_DEFAULT_SPACE_ID ?? "").trim(),
    writeKey: (process.env.HEARTGARDEN_MCP_WRITE_KEY ?? "").trim(),
    serviceKey,
    playerSpaceExcluded: (process.env.HEARTGARDEN_PLAYER_SPACE_ID ?? "").trim().toLowerCase(),
    gmBreakGlass: (process.env.HEARTGARDEN_GM_ALLOW_PLAYER_SPACE ?? "").trim() === "1",
  });

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  await server.connect(transport);
  return transport.handleRequest(requestWithStreamableHttpAccept(request));
}

export async function GET(request: NextRequest) {
  return handleMcpRequest(request);
}

export async function POST(request: NextRequest) {
  return handleMcpRequest(request);
}

export async function DELETE(request: NextRequest) {
  return handleMcpRequest(request);
}
