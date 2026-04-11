/**
 * End-to-end smoke test: Streamable HTTP MCP (same transport as Claude Desktop remote connector).
 *
 * Usage (from vigil/):
 *   HEARTGARDEN_MCP_SERVICE_KEY=your-secret npm run mcp:smoke
 *
 * Optional:
 *   HEARTGARDEN_MCP_URL=https://heartgarden.vercel.app/api/mcp   (default: production URL below)
 *
 * Uses the official MCP SDK client transport — not a hand-rolled fetch — so results should
 * match what Claude Desktop gets when it connects to the same URL.
 */
import process from "node:process";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const DEFAULT_MCP_URL = "https://heartgarden.vercel.app/api/mcp";

async function main(): Promise<void> {
  const key = (process.env.HEARTGARDEN_MCP_SERVICE_KEY ?? "").trim();
  if (!key) {
    console.error("Missing HEARTGARDEN_MCP_SERVICE_KEY (same secret as Vercel Production).");
    process.exit(1);
  }

  const base = (process.env.HEARTGARDEN_MCP_URL ?? DEFAULT_MCP_URL).trim();
  const mcpUrl = new URL(base);
  if (!mcpUrl.pathname.endsWith("/api/mcp") && !mcpUrl.pathname.endsWith("/api/mcp/")) {
    console.warn("Warning: URL path should end with /api/mcp");
  }
  mcpUrl.searchParams.set("token", key);

  const transport = new StreamableHTTPClientTransport(mcpUrl);
  const client = new Client({ name: "heartgarden-mcp-prod-smoke", version: "1.0.0" });

  try {
    await client.connect(transport);
    const server = client.getServerVersion();
    console.log(`initialize OK — server: ${server?.name ?? "?"} ${server?.version ?? ""}`.trim());

    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    console.log(`tools/list OK — ${names.length} tools`);
    const sample = names.filter((n) => n.startsWith("vigil_")).slice(0, 8);
    if (sample.length > 0) {
      console.log(`  sample: ${sample.join(", ")}`);
    } else {
      console.log(`  first few: ${names.slice(0, 8).join(", ")}`);
    }
  } finally {
    await transport.close().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
