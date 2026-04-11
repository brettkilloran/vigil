import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { authorizationBearerMatchesMcpServiceKey, heartgardenMcpServiceKeyFromEnv } from "@/src/lib/heartgarden-mcp-service-key";
import {
  createHeartgardenMcpServer,
  resolveHeartgardenMcpBaseUrl,
} from "@/src/lib/mcp/heartgarden-mcp-server";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

async function handleMcpRequest(request: Request): Promise<Response> {
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
  if (!authorizationBearerMatchesMcpServiceKey(request.headers.get("authorization"))) {
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
  return transport.handleRequest(request);
}

export async function GET(request: Request) {
  return handleMcpRequest(request);
}

export async function POST(request: Request) {
  return handleMcpRequest(request);
}

export async function DELETE(request: Request) {
  return handleMcpRequest(request);
}
