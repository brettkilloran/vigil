#!/usr/bin/env node
/**
 * MCP stdio server: VIGIL read helpers (list, get item, links, search, graph).
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
  { name: "vigil", version: "0.3.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "vigil_list_items",
      description:
        "List all canvas items in a space (REST v1 shape: version, space_id, items).",
      inputSchema: {
        type: "object",
        properties: {
          space_id: {
            type: "string",
            description: "UUID of the space (omit if VIGIL_DEFAULT_SPACE_ID is set)",
          },
        },
      },
    },
    {
      name: "vigil_search",
      description:
        "Search items in a space: fts (Postgres full-text), semantic (pgvector + OpenAI), or hybrid. Requires running app and DB; semantic/hybrid need OPENAI_API_KEY on the server.",
      inputSchema: {
        type: "object",
        properties: {
          space_id: { type: "string", description: "Space UUID" },
          q: { type: "string", description: "Query (at least 2 characters)" },
          mode: {
            type: "string",
            enum: ["fts", "semantic", "hybrid"],
            description: "Default fts",
          },
        },
        required: ["q"],
      },
    },
    {
      name: "vigil_graph",
      description:
        "Return nodes (items in space) and edges (item_links with both ends in space). Same payload as GET /api/spaces/:id/graph.",
      inputSchema: {
        type: "object",
        properties: {
          space_id: { type: "string", description: "Space UUID" },
        },
      },
    },
    {
      name: "vigil_get_item",
      description:
        "Fetch one canvas item by id (REST v1 shape: version, item). No space filter—item id is globally unique in DB.",
      inputSchema: {
        type: "object",
        properties: {
          item_id: { type: "string", description: "UUID of the item" },
        },
        required: ["item_id"],
      },
    },
    {
      name: "vigil_item_links",
      description:
        "Resolved wiki links for an item: outgoing and incoming (same as GET /api/items/:id/links).",
      inputSchema: {
        type: "object",
        properties: {
          item_id: { type: "string", description: "UUID of the item" },
        },
        required: ["item_id"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = request.params.arguments ?? {};

  if (name === "vigil_list_items") {
    const spaceId = args.space_id || SPACE;
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
    return { content: [{ type: "text", text: await res.text() }] };
  }

  if (name === "vigil_search") {
    const spaceId = args.space_id || SPACE;
    const q = String(args.q ?? "").trim();
    const mode = args.mode || "fts";
    if (!spaceId) {
      return {
        content: [
          { type: "text", text: "Missing space_id and VIGIL_DEFAULT_SPACE_ID" },
        ],
        isError: true,
      };
    }
    if (q.length < 2) {
      return {
        content: [{ type: "text", text: "Query q must be at least 2 characters." }],
        isError: true,
      };
    }
    const url = new URL("/api/search", BASE);
    url.searchParams.set("spaceId", String(spaceId));
    url.searchParams.set("q", q);
    url.searchParams.set("mode", String(mode));
    const res = await fetch(url);
    return { content: [{ type: "text", text: await res.text() }] };
  }

  if (name === "vigil_graph") {
    const spaceId = args.space_id || SPACE;
    if (!spaceId) {
      return {
        content: [
          { type: "text", text: "Missing space_id and VIGIL_DEFAULT_SPACE_ID" },
        ],
        isError: true,
      };
    }
    const res = await fetch(
      `${BASE}/api/spaces/${encodeURIComponent(String(spaceId))}/graph`,
    );
    return { content: [{ type: "text", text: await res.text() }] };
  }

  if (name === "vigil_get_item") {
    const itemId = String(args.item_id ?? "").trim();
    if (!itemId) {
      return {
        content: [{ type: "text", text: "item_id is required" }],
        isError: true,
      };
    }
    const res = await fetch(
      `${BASE}/api/v1/items/${encodeURIComponent(itemId)}`,
    );
    return { content: [{ type: "text", text: await res.text() }] };
  }

  if (name === "vigil_item_links") {
    const itemId = String(args.item_id ?? "").trim();
    if (!itemId) {
      return {
        content: [{ type: "text", text: "item_id is required" }],
        isError: true,
      };
    }
    const res = await fetch(
      `${BASE}/api/items/${encodeURIComponent(itemId)}/links`,
    );
    return { content: [{ type: "text", text: await res.text() }] };
  }

  return {
    content: [{ type: "text", text: "Unknown tool" }],
    isError: true,
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
