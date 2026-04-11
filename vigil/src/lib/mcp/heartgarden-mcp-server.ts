/**
 * Shared Heartgarden MCP server: tools + resources + HTTP fetch to HEARTGARDEN_APP_URL
 * with optional Bearer HEARTGARDEN_MCP_SERVICE_KEY for production boot gate.
 */
import { Server } from "@modelcontextprotocol/sdk/server";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import packageJson from "@/package.json";

export type HeartgardenMcpServerConfig = {
  baseUrl: string;
  defaultSpaceId: string;
  writeKey: string;
  serviceKey: string;
  playerSpaceExcluded: string;
  gmBreakGlass: boolean;
};

function mergeAuthHeaders(serviceKey: string, headers?: HeadersInit): Headers {
  const h = new Headers(headers);
  if (serviceKey.length > 0 && !h.has("Authorization")) {
    h.set("Authorization", `Bearer ${serviceKey}`);
  }
  return h;
}

/** Resolve app base URL for MCP tool fetches (stdio, HTTP handler, or serverless). */
export function resolveHeartgardenMcpBaseUrl(request?: Request): string {
  const fromEnv = (process.env.HEARTGARDEN_APP_URL ?? "").trim().replace(/\/$/, "");
  if (fromEnv.length > 0) return fromEnv;
  const vercel = (process.env.VERCEL_URL ?? "").trim();
  if (vercel.length > 0) {
    const host = vercel.replace(/^https?:\/\//, "");
    return `https://${host}`;
  }
  if (request) {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    if (host) return `${proto}://${host}`;
  }
  return "http://localhost:3000";
}

/**
 * Legacy MCP clients may still send `vigil_*` on `tools/call`; map to canonical `heartgarden_*`.
 * `tools/list` only exposes `heartgarden_*` — never advertise `vigil_*` in the schema.
 */
export function canonicalHeartgardenMcpToolName(raw: string): string {
  const s = String(raw ?? "").trim();
  if (s.startsWith("vigil_")) {
    return `heartgarden_${s.slice("vigil_".length)}`;
  }
  return s;
}

/** write_key must match config; empty string means “use server HEARTGARDEN_MCP_WRITE_KEY” when allowed. */
export function mcpWriteKeyError(
  args: Record<string, unknown>,
  writeKeyFromConfig: string,
  options: { allowOmitWhenConfigSet: boolean },
): string | null {
  const expected = writeKeyFromConfig.trim();
  if (!expected) {
    return "HEARTGARDEN_MCP_WRITE_KEY is not set on the MCP server process.";
  }
  const provided = String(args.write_key ?? "").trim();
  if (provided === "" && options.allowOmitWhenConfigSet) {
    return null;
  }
  if (provided === "") {
    return "write_key is required (or omit it when HEARTGARDEN_MCP_WRITE_KEY is set on the MCP server).";
  }
  if (provided !== expected) {
    return "Invalid write_key";
  }
  return null;
}

function filterGmSpaces(
  spaces: unknown[],
  playerSpaceExcluded: string,
  gmBreakGlass: boolean,
): unknown[] {
  if (gmBreakGlass || !playerSpaceExcluded || !Array.isArray(spaces)) return spaces;
  return spaces.filter((s) => String((s as { id?: string })?.id ?? "").toLowerCase() !== playerSpaceExcluded);
}

export function createHeartgardenMcpServer(config: HeartgardenMcpServerConfig): Server {
  const BASE = config.baseUrl.replace(/\/$/, "");
  const SPACE = config.defaultSpaceId;
  const WRITE_KEY = config.writeKey;
  const SERVICE_KEY = config.serviceKey;

  const api = (input: string | URL, init?: RequestInit) =>
    fetch(input, {
      ...init,
      headers: mergeAuthHeaders(SERVICE_KEY, init?.headers),
    });

  const server = new Server(
    { name: "heartgarden", version: packageJson.version },
    { capabilities: { tools: {}, resources: {} } },
  );

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    try {
      const res = await api(`${BASE}/api/spaces`);
      const data = (await res.json()) as { spaces?: unknown[] };
      const spaces = filterGmSpaces(
        Array.isArray(data.spaces) ? data.spaces : [],
        config.playerSpaceExcluded,
        config.gmBreakGlass,
      );
      return {
        resources: spaces.map((s) => {
          const row = s as { id: string; name?: string };
          return {
            uri: `lore://space/${row.id}`,
            name: row.name || "Space",
            mimeType: "application/json",
            description: `Canvas space ${row.id}`,
          };
        }),
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
    const spaceId = m[1]!;
    try {
      const [sumRes, graphRes] = await Promise.all([
        api(`${BASE}/api/spaces/${encodeURIComponent(spaceId)}/summary`),
        api(`${BASE}/api/spaces/${encodeURIComponent(spaceId)}/graph`),
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

  // MCP tools/list: only heartgarden_* — never expose vigil_* (legacy call aliases are handled in CallTool).
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "heartgarden_browse_spaces",
        description: "List all spaces (id, name, parent). GET /api/spaces.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "heartgarden_space_summary",
        description: "Item and in-space link counts for one space. GET /api/spaces/:id/summary.",
        inputSchema: {
          type: "object",
          properties: {
            space_id: { type: "string", description: "Space UUID" },
          },
        },
      },
      {
        name: "heartgarden_list_items",
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
        name: "heartgarden_search",
        description:
          "Search canvas items via GET /api/search. hybrid (default): FTS + fuzzy (+ vector RRF when embeddings are configured). semantic: vector-fused item ranking when embeddings are configured. fts | fuzzy: lexical only.",
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
        name: "heartgarden_graph",
        description: "Nodes and edges (item_links) for a space. GET /api/spaces/:id/graph.",
        inputSchema: {
          type: "object",
          properties: {
            space_id: { type: "string", description: "Space UUID" },
          },
        },
      },
      {
        name: "heartgarden_get_item",
        description: "Fetch one item by id (REST v1). Alias: heartgarden_get_entity.",
        inputSchema: {
          type: "object",
          properties: {
            item_id: { type: "string", description: "UUID of the item" },
          },
          required: ["item_id"],
        },
      },
      {
        name: "heartgarden_get_entity",
        description: "Same as heartgarden_get_item (summary-oriented name).",
        inputSchema: {
          type: "object",
          properties: {
            item_id: { type: "string", description: "UUID of the item / entity" },
          },
          required: ["item_id"],
        },
      },
      {
        name: "heartgarden_item_links",
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
        name: "heartgarden_traverse_links",
        description: "Expand item_links 1–2 hops from an item (HTTP fan-out to /links).",
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
        name: "heartgarden_related_items",
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
        name: "heartgarden_title_mentions",
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
        name: "heartgarden_lore_query",
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
        name: "heartgarden_semantic_search",
        description:
          "Return top matching text chunks (vector) with item ids. GET /api/search/chunks. Requires configured embeddings and indexed items. Omit space_id to search all spaces.",
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
        name: "heartgarden_index_item",
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
        name: "heartgarden_reindex_space",
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
        name: "heartgarden_patch_item",
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
      {
        name: "heartgarden_create_item",
        description:
          "Create a canvas item in a space (POST /api/spaces/:id/items). Requires write_key (or omit when HEARTGARDEN_MCP_WRITE_KEY is set on the MCP server). item_type 'character' creates a lore entity card (note + entityType=character).",
        inputSchema: {
          type: "object",
          properties: {
            write_key: {
              type: "string",
              description: "Must match HEARTGARDEN_MCP_WRITE_KEY; may be omitted if the MCP process has that env set",
            },
            space_id: { type: "string", description: "Target space UUID" },
            item_type: {
              type: "string",
              enum: ["note", "checklist", "character"],
              description: "character → note row with entityType=character",
            },
            title: { type: "string" },
            content_text: { type: "string", description: "Plain text; required for notes (not checklists)" },
            x: { type: "number" },
            y: { type: "number" },
            color: { type: "string", description: "CSS color; defaults server-side" },
            theme: { type: "string", enum: ["default", "code", "task"], description: "Card theme for synthesized contentJson" },
            auto_index: { type: "boolean", description: "If true, POST /api/items/:id/index after create" },
          },
          required: ["space_id", "item_type", "title"],
        },
      },
      {
        name: "heartgarden_create_link",
        description:
          "Create a directed item_link (POST /api/item-links). source_item_id → target_item_id. relationship_type maps to the API linkType field. Both items must be in the same space as space_id.",
        inputSchema: {
          type: "object",
          properties: {
            write_key: {
              type: "string",
              description: "Must match HEARTGARDEN_MCP_WRITE_KEY; may be omitted if the MCP process has that env set",
            },
            space_id: { type: "string", description: "Space UUID (both items must belong here)" },
            source_item_id: { type: "string" },
            target_item_id: { type: "string" },
            label: { type: "string", description: "Edge label shown on the canvas" },
            relationship_type: { type: "string", description: "Stored as linkType (e.g. faction_membership)" },
          },
          required: ["space_id", "source_item_id", "target_item_id"],
        },
      },
    ],
  }));

  async function fetchItemLinks(itemId: string) {
    const res = await api(`${BASE}/api/items/${encodeURIComponent(itemId)}/links`);
    return res.json() as Promise<{
      outgoing?: { to?: { id?: string } }[];
      incoming?: { from?: { id?: string } }[];
    }>;
  }

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = canonicalHeartgardenMcpToolName(String(request.params.name ?? ""));
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;

    if (name === "heartgarden_browse_spaces") {
      const res = await api(`${BASE}/api/spaces`);
      const text = await res.text();
      try {
        const data = JSON.parse(text) as { spaces?: unknown[] };
        if (data && Array.isArray(data.spaces)) {
          data.spaces = filterGmSpaces(data.spaces, config.playerSpaceExcluded, config.gmBreakGlass);
          return { content: [{ type: "text", text: JSON.stringify(data) }] };
        }
      } catch {
        /* passthrough */
      }
      return { content: [{ type: "text", text }] };
    }

    if (name === "heartgarden_space_summary") {
      const spaceId = String(args.space_id ?? "").trim() || SPACE;
      if (!spaceId) {
        return {
          content: [{ type: "text", text: "Missing space_id and HEARTGARDEN_DEFAULT_SPACE_ID" }],
          isError: true,
        };
      }
      const res = await api(`${BASE}/api/spaces/${encodeURIComponent(spaceId)}/summary`);
      return { content: [{ type: "text", text: await res.text() }] };
    }

    if (name === "heartgarden_list_items") {
      const spaceId = (args.space_id as string | undefined) || SPACE;
      if (!spaceId) {
        return {
          content: [
            { type: "text", text: "Missing space_id and HEARTGARDEN_DEFAULT_SPACE_ID" },
          ],
          isError: true,
        };
      }
      const res = await api(`${BASE}/api/v1/items?space_id=${encodeURIComponent(String(spaceId))}`);
      return { content: [{ type: "text", text: await res.text() }] };
    }

    if (name === "heartgarden_search") {
      const spaceId = (args.space_id as string | undefined) || SPACE;
      const q = String(args.q ?? "").trim();
      const mode = (args.mode as string | undefined) || "hybrid";
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
      const res = await api(url);
      return { content: [{ type: "text", text: await res.text() }] };
    }

    if (name === "heartgarden_graph") {
      const spaceId = (args.space_id as string | undefined) || SPACE;
      if (!spaceId) {
        return {
          content: [
            { type: "text", text: "Missing space_id and HEARTGARDEN_DEFAULT_SPACE_ID" },
          ],
          isError: true,
        };
      }
      const res = await api(`${BASE}/api/spaces/${encodeURIComponent(String(spaceId))}/graph`);
      return { content: [{ type: "text", text: await res.text() }] };
    }

    if (name === "heartgarden_get_item" || name === "heartgarden_get_entity") {
      const itemId = String(args.item_id ?? "").trim();
      if (!itemId) {
        return {
          content: [{ type: "text", text: "item_id is required" }],
          isError: true,
        };
      }
      const res = await api(`${BASE}/api/v1/items/${encodeURIComponent(itemId)}`);
      return { content: [{ type: "text", text: await res.text() }] };
    }

    if (name === "heartgarden_item_links") {
      const itemId = String(args.item_id ?? "").trim();
      if (!itemId) {
        return {
          content: [{ type: "text", text: "item_id is required" }],
          isError: true,
        };
      }
      const res = await api(`${BASE}/api/items/${encodeURIComponent(itemId)}/links`);
      return { content: [{ type: "text", text: await res.text() }] };
    }

    if (name === "heartgarden_traverse_links") {
      const itemId = String(args.item_id ?? "").trim();
      const depth = Math.min(2, Math.max(1, Number(args.depth) || 1));
      if (!itemId) {
        return {
          content: [{ type: "text", text: "item_id is required" }],
          isError: true,
        };
      }
      const root = await fetchItemLinks(itemId);
      const out: { root: typeof root; hops: Record<string, unknown> } = { root, hops: {} };
      if (depth < 2) {
        return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
      }
      const peerIds = new Set<string>();
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

    if (name === "heartgarden_related_items") {
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
      const res = await api(`${BASE}/api/items/${encodeURIComponent(itemId)}/related?${q.toString()}`);
      return { content: [{ type: "text", text: await res.text() }] };
    }

    if (name === "heartgarden_title_mentions") {
      const itemId = String(args.item_id ?? "").trim();
      const spaceId = (args.space_id as string | undefined) || SPACE;
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
      const itemRes = await api(`${BASE}/api/v1/items/${encodeURIComponent(itemId)}`);
      const itemJson = (await itemRes.json()) as { item?: { title?: string } };
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
      const res = await api(url);
      return { content: [{ type: "text", text: await res.text() }] };
    }

    if (name === "heartgarden_lore_query") {
      const question = String(args.question ?? "").trim();
      if (!question) {
        return {
          content: [{ type: "text", text: "question is required" }],
          isError: true,
        };
      }
      const body: Record<string, unknown> = { question };
      if (args.space_id) body.spaceId = String(args.space_id);
      if (args.limit != null) body.limit = Number(args.limit);
      const res = await api(`${BASE}/api/lore/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return { content: [{ type: "text", text: await res.text() }] };
    }

    if (name === "heartgarden_semantic_search") {
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
      const res = await api(url);
      return { content: [{ type: "text", text: await res.text() }] };
    }

    if (name === "heartgarden_index_item") {
      const itemId = String(args.item_id ?? "").trim();
      if (!itemId) {
        return {
          content: [{ type: "text", text: "item_id is required" }],
          isError: true,
        };
      }
      const payload = args.refresh_lore_meta === false ? { refreshLoreMeta: false } : {};
      const res = await api(`${BASE}/api/items/${encodeURIComponent(itemId)}/index`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return { content: [{ type: "text", text: await res.text() }] };
    }

    if (name === "heartgarden_reindex_space") {
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
      const res = await api(`${BASE}/api/spaces/${encodeURIComponent(spaceId)}/reindex`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          write_key: WRITE_KEY,
          refreshLoreMeta: args.refresh_lore_meta !== false,
        }),
      });
      return { content: [{ type: "text", text: await res.text() }] };
    }

    if (name === "heartgarden_patch_item") {
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
      const patch: { title?: string; contentText?: string } = {};
      if (typeof args.title === "string") patch.title = args.title;
      if (typeof args.content_text === "string") patch.contentText = args.content_text;
      if (Object.keys(patch).length === 0) {
        return {
          content: [{ type: "text", text: "Provide title and/or content_text to patch" }],
          isError: true,
        };
      }
      const res = await api(`${BASE}/api/items/${encodeURIComponent(itemId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      return { content: [{ type: "text", text: await res.text() }] };
    }

    if (name === "heartgarden_create_item") {
      const wkErr = mcpWriteKeyError(args, WRITE_KEY, { allowOmitWhenConfigSet: true });
      if (wkErr) {
        return { content: [{ type: "text", text: wkErr }], isError: true };
      }
      const spaceId = String(args.space_id ?? "").trim();
      if (!spaceId) {
        return { content: [{ type: "text", text: "space_id is required" }], isError: true };
      }
      const itemTypeRaw = String(args.item_type ?? "").trim();
      const title = String(args.title ?? "").trim();
      if (!title) {
        return { content: [{ type: "text", text: "title is required" }], isError: true };
      }
      let itemType: "note" | "checklist";
      let entityType: string | undefined;
      if (itemTypeRaw === "character") {
        itemType = "note";
        entityType = "character";
      } else if (itemTypeRaw === "note" || itemTypeRaw === "checklist") {
        itemType = itemTypeRaw;
      } else {
        return {
          content: [{ type: "text", text: "item_type must be note, checklist, or character" }],
          isError: true,
        };
      }
      const contentText = typeof args.content_text === "string" ? args.content_text : "";
      if (itemType === "note" && contentText.trim() === "") {
        return {
          content: [{ type: "text", text: "content_text is required for notes and character cards" }],
          isError: true,
        };
      }
      const body: Record<string, unknown> = {
        itemType,
        title,
        contentText,
        x: typeof args.x === "number" ? args.x : 0,
        y: typeof args.y === "number" ? args.y : 0,
      };
      if (entityType) body.entityType = entityType;
      if (typeof args.color === "string" && args.color.trim()) body.color = args.color.trim();
      if (args.theme === "default" || args.theme === "code" || args.theme === "task") {
        body.theme = args.theme;
      }
      const res = await api(`${BASE}/api/spaces/${encodeURIComponent(spaceId)}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const createText = await res.text();
      if (args.auto_index !== true) {
        return { content: [{ type: "text", text: createText }] };
      }
      try {
        const created = JSON.parse(createText) as { ok?: boolean; item?: { id?: string } };
        const newId = created?.item?.id;
        if (!created?.ok || !newId) {
          return { content: [{ type: "text", text: createText }] };
        }
        const idxRes = await api(`${BASE}/api/items/${encodeURIComponent(newId)}/index`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const indexText = await idxRes.text();
        let indexPayload: unknown = indexText;
        try {
          indexPayload = JSON.parse(indexText);
        } catch {
          /* keep raw string */
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ create: created, index: indexPayload }, null, 2),
            },
          ],
        };
      } catch {
        return { content: [{ type: "text", text: createText }] };
      }
    }

    if (name === "heartgarden_create_link") {
      const wkErr = mcpWriteKeyError(args, WRITE_KEY, { allowOmitWhenConfigSet: true });
      if (wkErr) {
        return { content: [{ type: "text", text: wkErr }], isError: true };
      }
      const spaceId = String(args.space_id ?? "").trim();
      const sourceId = String(args.source_item_id ?? "").trim();
      const targetId = String(args.target_item_id ?? "").trim();
      if (!spaceId || !sourceId || !targetId) {
        return {
          content: [
            {
              type: "text",
              text: "space_id, source_item_id, and target_item_id are required",
            },
          ],
          isError: true,
        };
      }
      const [srcRes, tgtRes] = await Promise.all([
        api(`${BASE}/api/v1/items/${encodeURIComponent(sourceId)}`),
        api(`${BASE}/api/v1/items/${encodeURIComponent(targetId)}`),
      ]);
      if (!srcRes.ok || !tgtRes.ok) {
        return {
          content: [{ type: "text", text: "Could not load source or target item" }],
          isError: true,
        };
      }
      const srcJson = (await srcRes.json()) as { item?: { spaceId?: string } };
      const tgtJson = (await tgtRes.json()) as { item?: { spaceId?: string } };
      const s1 = srcJson?.item?.spaceId;
      const s2 = tgtJson?.item?.spaceId;
      if (!s1 || !s2 || s1 !== spaceId || s2 !== spaceId) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ok: false,
                error: "Source and target items must exist and belong to space_id",
              }),
            },
          ],
          isError: true,
        };
      }
      const linkBody: Record<string, unknown> = {
        sourceItemId: sourceId,
        targetItemId: targetId,
      };
      if (typeof args.label === "string" && args.label.trim()) linkBody.label = args.label.trim();
      if (typeof args.relationship_type === "string" && args.relationship_type.trim()) {
        linkBody.linkType = args.relationship_type.trim();
      }
      const res = await api(`${BASE}/api/item-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(linkBody),
      });
      return { content: [{ type: "text", text: await res.text() }] };
    }

    return {
      content: [{ type: "text", text: "Unknown tool" }],
      isError: true,
    };
  });

  return server;
}
