/**
 * End-to-end smoke test: Streamable HTTP MCP (same transport as Claude Desktop remote connector).
 *
 * Usage (from heartgarden/):
 *   HEARTGARDEN_MCP_SERVICE_KEY=your-secret npm run mcp:smoke
 *
 * Optional:
 *   HEARTGARDEN_MCP_URL=https://heartgarden.vercel.app/api/mcp   (default: production URL below)
 *   HEARTGARDEN_VERCEL_PROTECTION_BYPASS=<secret>   (only if Deployment Protection is on; see docs)
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

  const protectionBypass = (process.env.HEARTGARDEN_VERCEL_PROTECTION_BYPASS ?? "").trim();
  if (protectionBypass) {
    mcpUrl.searchParams.set("x-vercel-protection-bypass", protectionBypass);
  }

  const transport = new StreamableHTTPClientTransport(mcpUrl);
  const client = new Client({ name: "heartgarden-mcp-prod-smoke", version: "1.0.0" });

  try {
    await client.connect(transport);
    const server = client.getServerVersion();
    console.log(`initialize OK — server: ${server?.name ?? "?"} ${server?.version ?? ""}`.trim());

    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    console.log(`tools/list OK — ${names.length} tools`);

    const vigilListed = names.filter((n) => n.startsWith("vigil_"));
    if (vigilListed.length > 0) {
      console.error(
        `FAIL: tools/list must not expose vigil_* names (canonical is heartgarden_*): ${vigilListed.join(", ")}`,
      );
      process.exitCode = 1;
      return;
    }

    const heartgardenTools = names.filter((n) => n.startsWith("heartgarden_"));
    if (names.length > 0 && heartgardenTools.length === 0) {
      console.error(
        `FAIL: expected Heartgarden MCP tools to use heartgarden_* prefix; got: ${names.slice(0, 12).join(", ")}`,
      );
      process.exitCode = 1;
      return;
    }

    const sample = heartgardenTools.slice(0, 8);
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
