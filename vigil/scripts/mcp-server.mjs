#!/usr/bin/env node
/**
 * MCP stdio server: heartgarden lore + canvas helpers.
 * Run: npm run mcp (HEARTGARDEN_APP_URL, optional HEARTGARDEN_DEFAULT_SPACE_ID, optional HEARTGARDEN_MCP_WRITE_KEY)
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const PKG = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../package.json"), "utf8"),
);

const BASE = (process.env.HEARTGARDEN_APP_URL || "http://localhost:3000").replace(
  /\/$/,
  "",
);
const SPACE = process.env.HEARTGARDEN_DEFAULT_SPACE_ID || "";
const WRITE_KEY = (process.env.HEARTGARDEN_MCP_WRITE_KEY || "").trim();

const server = new Server(
  { name: "heartgarden", version: PKG.version },
  { capabilities: { tools: {}, resources: {} } },
);

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  try {
    const res = await fetch(`${BASE}/api/spaces`);
    const data = await res.json();
    const spaces = Array.isArray(data.spaces) ? data.spaces : [];
    return {
      resources: spaces.map((s) => ({
        uri: `lore://space/${s.id}`,
        name: s.name || "Space",
        mimeType: "application/json",
        description: `Canvas space ${s.id}`,
      })),
    };
  } catch {
    return { resources: [] };
  }
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = String(request.params.uri ?? "");
  const m = /^lore:\/\/space\/([0-9a-f-]{36})$/i.exec(uri);
  if (!m) {
    return {
      contents: [
        {
          uri,
          mimeType: "text/plain",
          text: "Unknown resource URI (expected lore://space/<uuid>)",
        },
      ],
    };
  }
  const spaceId = m[1];
  try {
    const [sumRes, graphRes] = await Promise.all([
      fetch(`${BASE}/api/spaces/${encodeURIComponent(spaceId)}/summary`),
      fetch(`${BASE}/api/spaces/${encodeURIComponent(spaceId)}/graph`),
    ]);
    const summary = await sumRes.json();
    const graph = await graphRes.json();
    const text = JSON.stringify({ summary, graph }, null, 2);
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text,
        },
      ],
    };
  } catch (e) {
    return {
      contents: [
        {
          uri,
          mimeType: "text/plain",
          text: `Failed to read resource: ${e instanceof Error ? e.message : String(e)}`,
        },
      ],
    };
  }
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "vigil_browse_spaces",
      description: "List all spaces (id, name, parent). GET /api/spaces.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "vigil_space_summary",
      description: "Item and in-space link counts for one space. GET /api/spaces/:id/summary.",
      inputSchema: {
        type: "object",
        properties: {
          space_id: { type: "string", description: "Space UUID" },
        },
      },
    },
    {
      name: "vigil_list_items",
      description:
        "List all canvas items in a space (REST v1 shape: version, space_id, items).",
      inputSchema: {
        type: "object",
        properties: {
          space_id: {
            type: "string",
            description: "UUID of the space (omit if HEARTGARDEN_DEFAULT_SPACE_ID is set)",
          },
        },
      },
    },
    {
      name: "vigil_search",
      description:
        "Search canvas items via GET /api/search. hybrid (default): FTS + fuzzy + vector RRF when the app has OPENAI_API_KEY. semantic: vector-fused item ranking. fts | fuzzy: lexical only.",
      inputSchema: {
        type: "object",
        properties: {
          space_id: { type: "string", description: "Space UUID" },
          q: { type: "string", description: "Query (at least 2 characters)" },
          mode: {
            type: "string",
            enum: ["fts", "fuzzy", "semantic", "hybrid"],
            description: "Default hybrid",
          },
        },
        required: ["q"],
      },
    },
    {
      name: "vigil_graph",
      description:
        "Nodes and edges (item_links) for a space. GET /api/spaces/:id/graph.",
      inputSchema: {
        type: "object",
        properties: {
          space_id: { type: "string", description: "Space UUID" },
        },
      },
    },
    {
      name: "vigil_get_item",
      description: "Fetch one item by id (REST v1). Alias: vigil_get_entity.",
      inputSchema: {
        type: "object",
        properties: {
          item_id: { type: "string", description: "UUID of the item" },
        },
        required: ["item_id"],
      },
    },
    {
      name: "vigil_get_entity",
      description: "Same as vigil_get_item (summary-oriented name).",
      inputSchema: {
        type: "object",
        properties: {
          item_id: { type: "string", description: "UUID of the item / entity" },
        },
        required: ["item_id"],
      },
    },
    {
      name: "vigil_item_links",
      description: "Outgoing and incoming item_links for one item.",
      inputSchema: {
        type: "object",
        properties: {
          item_id: { type: "string", description: "UUID of the item" },
        },
        required: ["item_id"],
      },
    },
    {
      name: "vigil_traverse_links",
      description:
        "Expand item_links 1–2 hops from an item (HTTP fan-out to /links).",
      inputSchema: {
        type: "object",
        properties: {
          item_id: { type: "string" },
          depth: { type: "integer", description: "1 or 2", minimum: 1, maximum: 2 },
        },
        required: ["item_id"],
      },
    },
    {
      name: "vigil_related_items",
      description: "FTS-based related items in a space. GET /api/items/:id/related.",
      inputSchema: {
        type: "object",
        properties: {
          item_id: { type: "string" },
          space_id: { type: "string", description: "Optional override; defaults to item's space" },
          limit: { type: "integer", description: "Default 8" },
        },
        required: ["item_id"],
      },
    },
    {
      name: "vigil_title_mentions",
      description: "FTS search for an item's title in a space (GET /api/search fts).",
      inputSchema: {
        type: "object",
        properties: {
          item_id: { type: "string" },
          space_id: {
            type: "string",
            description: "Space UUID (omit if HEARTGARDEN_DEFAULT_SPACE_ID is set)",
          },
        },
        required: ["item_id"],
      },
    },
    {
      name: "vigil_lore_query",
      description:
        "Ask a natural-language question; hybrid retrieval (FTS + vectors + graph neighbors) then Claude synthesizes. POST /api/lore/query.",
      inputSchema: {
        type: "object",
        properties: {
          question: { type: "string" },
          space_id: { type: "string", description: "Optional space UUID filter" },
          limit: { type: "integer", description: "Max sources 1–24, default 14" },
        },
        required: ["question"],
      },
    },
    {
      name: "vigil_semantic_search",
      description:
        "Return top matching text chunks (vector) with item ids. GET /api/search/chunks. Requires app OPENAI_API_KEY and indexed items. Omit space_id to search all spaces.",
      inputSchema: {
        type: "object",
        properties: {
          space_id: {
            type: "string",
            description: "Optional space UUID; else HEARTGARDEN_DEFAULT_SPACE_ID or all spaces",
          },
          q: { type: "string", description: "Query (at least 2 characters)" },
          limit: { type: "integer", description: "Max chunks, default 24" },
        },
        required: ["q"],
      },
    },
    {
      name: "vigil_index_item",
      description:
        "Chunk + embed one item and refresh lore summary/aliases (Anthropic). POST /api/items/:id/index. Rate-limited.",
      inputSchema: {
        type: "object",
        properties: {
          item_id: { type: "string" },
          refresh_lore_meta: {
            type: "boolean",
            description: "Default true; set false to skip Anthropic lore fields",
          },
        },
        required: ["item_id"],
      },
    },
    {
      name: "vigil_reindex_space",
      description:
        "Reindex all items in a space (embeddings + optional lore meta). POST /api/spaces/:id/reindex. Requires write_key matching HEARTGARDEN_MCP_WRITE_KEY.",
      inputSchema: {
        type: "object",
        properties: {
          write_key: { type: "string" },
          space_id: { type: "string", description: "Space UUID" },
          refresh_lore_meta: { type: "boolean", description: "Default true" },
        },
        required: ["write_key", "space_id"],
      },
    },
    {
      name: "vigil_patch_item",
      description:
        "PATCH fields on an item. Requires HEARTGARDEN_MCP_WRITE_KEY on the server and matching write_key argument.",
      inputSchema: {
        type: "object",
        properties: {
          write_key: { type: "string", description: "Must match HEARTGARDEN_MCP_WRITE_KEY" },
          item_id: { type: "string" },
          title: { type: "string" },
          content_text: { type: "string", description: "Plain text body" },
        },
        required: ["write_key", "item_id"],
      },
    },
  ],
}));

async function fetchItemLinks(itemId) {
  const res = await fetch(`${BASE}/api/items/${encodeURIComponent(itemId)}/links`);
  return res.json();
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = request.params.arguments ?? {};

  if (name === "vigil_browse_spaces") {
    const res = await fetch(`${BASE}/api/spaces`);
    return { content: [{ type: "text", text: await res.text() }] };
  }

  if (name === "vigil_space_summary") {
    const spaceId = String(args.space_id ?? "").trim() || SPACE;
    if (!spaceId) {
      return {
        content: [{ type: "text", text: "Missing space_id and HEARTGARDEN_DEFAULT_SPACE_ID" }],
        isError: true,
      };
    }
    const res = await fetch(`${BASE}/api/spaces/${encodeURIComponent(spaceId)}/summary`);
    return { content: [{ type: "text", text: await res.text() }] };
  }

  if (name === "vigil_list_items") {
    const spaceId = args.space_id || SPACE;
    if (!spaceId) {
      return {
        content: [
          { type: "text", text: "Missing space_id and HEARTGARDEN_DEFAULT_SPACE_ID" },
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
    const mode = args.mode || "hybrid";
    if (!spaceId) {
      return {
        content: [
          { type: "text", text: "Missing space_id and HEARTGARDEN_DEFAULT_SPACE_ID" },
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
          { type: "text", text: "Missing space_id and HEARTGARDEN_DEFAULT_SPACE_ID" },
        ],
        isError: true,
      };
    }
    const res = await fetch(
      `${BASE}/api/spaces/${encodeURIComponent(String(spaceId))}/graph`,
    );
    return { content: [{ type: "text", text: await res.text() }] };
  }

  if (name === "vigil_get_item" || name === "vigil_get_entity") {
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

  if (name === "vigil_traverse_links") {
    const itemId = String(args.item_id ?? "").trim();
    const depth = Math.min(2, Math.max(1, Number(args.depth) || 1));
    if (!itemId) {
      return {
        content: [{ type: "text", text: "item_id is required" }],
        isError: true,
      };
    }
    const root = await fetchItemLinks(itemId);
    const out = { root, hops: /** @type {Record<string, unknown>} */ ({}) };
    if (depth < 2) {
      return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
    }
    const peerIds = new Set();
    for (const r of root.outgoing ?? []) {
      if (r.to?.id) peerIds.add(r.to.id);
    }
    for (const r of root.incoming ?? []) {
      if (r.from?.id) peerIds.add(r.from.id);
    }
    peerIds.delete(itemId);
    for (const pid of peerIds) {
      out.hops[pid] = await fetchItemLinks(pid);
    }
    return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
  }

  if (name === "vigil_related_items") {
    const itemId = String(args.item_id ?? "").trim();
    if (!itemId) {
      return {
        content: [{ type: "text", text: "item_id is required" }],
        isError: true,
      };
    }
    const limit = args.limit != null ? Number(args.limit) : 8;
    const spaceId = args.space_id ? String(args.space_id) : "";
    const q = new URLSearchParams();
    if (spaceId) q.set("spaceId", spaceId);
    q.set("limit", String(limit));
    const res = await fetch(
      `${BASE}/api/items/${encodeURIComponent(itemId)}/related?${q.toString()}`,
    );
    return { content: [{ type: "text", text: await res.text() }] };
  }

  if (name === "vigil_title_mentions") {
    const itemId = String(args.item_id ?? "").trim();
    const spaceId = args.space_id || SPACE;
    if (!itemId) {
      return {
        content: [{ type: "text", text: "item_id is required" }],
        isError: true,
      };
    }
    if (!spaceId) {
      return {
        content: [
          { type: "text", text: "Missing space_id and HEARTGARDEN_DEFAULT_SPACE_ID" },
        ],
        isError: true,
      };
    }
    const itemRes = await fetch(
      `${BASE}/api/v1/items/${encodeURIComponent(itemId)}`,
    );
    const itemJson = await itemRes.json();
    const title = String(itemJson?.item?.title ?? "").trim();
    if (title.length < 3) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              ok: true,
              note: "Title too short for FTS (need ≥3 characters).",
              items: [],
            }),
          },
        ],
      };
    }
    const url = new URL("/api/search", BASE);
    url.searchParams.set("spaceId", String(spaceId));
    url.searchParams.set("q", title.slice(0, 200));
    url.searchParams.set("mode", "fts");
    const res = await fetch(url);
    return { content: [{ type: "text", text: await res.text() }] };
  }

  if (name === "vigil_lore_query") {
    const question = String(args.question ?? "").trim();
    if (!question) {
      return {
        content: [{ type: "text", text: "question is required" }],
        isError: true,
      };
    }
    const body = {
      question,
      ...(args.space_id ? { spaceId: String(args.space_id) } : {}),
      ...(args.limit != null ? { limit: Number(args.limit) } : {}),
    };
    const res = await fetch(`${BASE}/api/lore/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { content: [{ type: "text", text: await res.text() }] };
  }

  if (name === "vigil_semantic_search") {
    const spaceId = args.space_id ? String(args.space_id).trim() : SPACE;
    const q = String(args.q ?? "").trim();
    if (q.length < 2) {
      return {
        content: [{ type: "text", text: "Query q must be at least 2 characters." }],
        isError: true,
      };
    }
    const url = new URL("/api/search/chunks", BASE);
    if (spaceId) url.searchParams.set("spaceId", spaceId);
    url.searchParams.set("q", q);
    if (args.limit != null) url.searchParams.set("limit", String(args.limit));
    const res = await fetch(url);
    return { content: [{ type: "text", text: await res.text() }] };
  }

  if (name === "vigil_index_item") {
    const itemId = String(args.item_id ?? "").trim();
    if (!itemId) {
      return {
        content: [{ type: "text", text: "item_id is required" }],
        isError: true,
      };
    }
    const payload =
      args.refresh_lore_meta === false ? { refreshLoreMeta: false } : {};
    const res = await fetch(`${BASE}/api/items/${encodeURIComponent(itemId)}/index`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { content: [{ type: "text", text: await res.text() }] };
  }

  if (name === "vigil_reindex_space") {
    if (!WRITE_KEY) {
      return {
        content: [
          {
            type: "text",
            text: "HEARTGARDEN_MCP_WRITE_KEY is not set on the MCP server process.",
          },
        ],
        isError: true,
      };
    }
    if (String(args.write_key ?? "") !== WRITE_KEY) {
      return {
        content: [{ type: "text", text: "Invalid write_key" }],
        isError: true,
      };
    }
    const spaceId = String(args.space_id ?? "").trim();
    if (!spaceId) {
      return {
        content: [{ type: "text", text: "space_id is required" }],
        isError: true,
      };
    }
    const res = await fetch(`${BASE}/api/spaces/${encodeURIComponent(spaceId)}/reindex`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        write_key: WRITE_KEY,
        refreshLoreMeta: args.refresh_lore_meta !== false,
      }),
    });
    return { content: [{ type: "text", text: await res.text() }] };
  }

  if (name === "vigil_patch_item") {
    if (!WRITE_KEY) {
      return {
        content: [
          {
            type: "text",
            text: "HEARTGARDEN_MCP_WRITE_KEY is not set on the MCP server process.",
          },
        ],
        isError: true,
      };
    }
    if (String(args.write_key ?? "") !== WRITE_KEY) {
      return {
        content: [{ type: "text", text: "Invalid write_key" }],
        isError: true,
      };
    }
    const itemId = String(args.item_id ?? "").trim();
    if (!itemId) {
      return {
        content: [{ type: "text", text: "item_id is required" }],
        isError: true,
      };
    }
    const patch = {};
    if (typeof args.title === "string") patch.title = args.title;
    if (typeof args.content_text === "string") patch.contentText = args.content_text;
    if (Object.keys(patch).length === 0) {
      return {
        content: [{ type: "text", text: "Provide title and/or content_text to patch" }],
        isError: true,
      };
    }
    const res = await fetch(`${BASE}/api/items/${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    return { content: [{ type: "text", text: await res.text() }] };
  }

  return {
    content: [{ type: "text", text: "Unknown tool" }],
    isError: true,
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
