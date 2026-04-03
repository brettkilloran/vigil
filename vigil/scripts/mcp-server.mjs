#!/usr/bin/env node
/**
 * Minimal MCP stdio server exposing VIGIL read helpers.
 * Run: npm run mcp  (set NEON_DATABASE_URL; optional VIGIL_DEFAULT_SPACE_ID)
 */
import { Server } from "@modelcontextprotocol/sdk/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const BASE =
  process.env.VIGIL_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
const SPACE = process.env.VIGIL_DEFAULT_SPACE_ID || "";

const server = new Server(
  { name: "vigil", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "vigil_list_items",
      description: "List canvas items in a space (REST v1).",
      inputSchema: {
        type: "object",
        properties: {
          space_id: { type: "string", description: "UUID of the space" },
        },
        required: ["space_id"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "vigil_list_items") {
    const spaceId = request.params.arguments?.space_id || SPACE;
    if (!spaceId) {
      return {
        content: [
          { type: "text", text: "Missing space_id and VIGIL_DEFAULT_SPACE_ID" },
        ],
        isError: true,
      };
    }
    const res = await fetch(
      `${BASE}/api/v1/items?space_id=${encodeURIComponent(String(spaceId))}`,
    );
    const text = await res.text();
    return { content: [{ type: "text", text }] };
  }
  return {
    content: [{ type: "text", text: "Unknown tool" }],
    isError: true,
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
