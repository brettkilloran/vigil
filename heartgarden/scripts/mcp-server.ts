/**
 * MCP stdio server: heartgarden lore + canvas helpers (`tools/list` → heartgarden_*; `tools/call` accepts legacy vigil_*).
 * Run: pnpm run mcp (HEARTGARDEN_APP_URL, HEARTGARDEN_MCP_SERVICE_KEY for gated APIs,
 * optional HEARTGARDEN_DEFAULT_SPACE_ID, optional HEARTGARDEN_MCP_WRITE_KEY,
 * optional HEARTGARDEN_MCP_READ_ONLY=1 to disable write tools)
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  createHeartgardenMcpServer,
  resolveHeartgardenMcpBaseUrl,
} from "../src/lib/mcp/heartgarden-mcp-server";

const baseUrl = resolveHeartgardenMcpBaseUrl();
const serviceKey = (process.env.HEARTGARDEN_MCP_SERVICE_KEY ?? "").trim();

const server = createHeartgardenMcpServer({
  baseUrl,
  defaultSpaceId: (process.env.HEARTGARDEN_DEFAULT_SPACE_ID ?? "").trim(),
  writeKey: (process.env.HEARTGARDEN_MCP_WRITE_KEY ?? "").trim(),
  serviceKey,
  playerSpaceExcluded: (process.env.HEARTGARDEN_PLAYER_SPACE_ID ?? "").trim().toLowerCase(),
  gmBreakGlass: (process.env.HEARTGARDEN_GM_ALLOW_PLAYER_SPACE ?? "").trim() === "1",
  readOnly: (process.env.HEARTGARDEN_MCP_READ_ONLY ?? "").trim() === "1",
});

const transport = new StdioServerTransport();
await server.connect(transport);
