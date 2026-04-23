/**
 * Shared Heartgarden MCP server: tools + resources + HTTP fetch to HEARTGARDEN_APP_URL
 * with optional Bearer HEARTGARDEN_MCP_SERVICE_KEY for production boot gate.
 * Request bodies mirror `app/api/**` handlers (Zod + Drizzle there); keep wire shapes aligned when editing tools.
 */
import { Server } from "@modelcontextprotocol/sdk/server";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import packageJson from "@/package.json";
import { normalizeLinkTypeAlias } from "@/src/lib/connection-kind-colors";
import { anthropicLlmDeadlineMs } from "@/src/lib/async-timeout";
import { deriveSectionsFromHgDoc } from "@/src/lib/hg-doc/derive-sections";
import { isHgDocContentJson, readHgDocFromContentJson } from "@/src/lib/hg-doc/serialize";
import { markdownToStructuredBody, structuredBodyToHgDoc } from "@/src/lib/hg-doc/structured-body-to-hg-doc";
import { hgStructuredBlockSchema, type HgStructuredBlock } from "@/src/lib/hg-doc/structured-body";

export type HeartgardenMcpServerConfig = {
  baseUrl: string;
  defaultSpaceId: string;
  writeKey: string;
  serviceKey: string;
  playerSpaceExcluded: string;
  gmBreakGlass: boolean;
  /** When true, write tools return a clear error (set HEARTGARDEN_MCP_READ_ONLY=1 on the MCP process). */
  readOnly: boolean;
};

/** Max characters accepted for content_text on create/patch before calling the API (fails fast with a clear MCP error). */
export const MCP_MAX_CONTENT_TEXT_CHARS = 2_000_000;

const HEARTGARDEN_MCP_WRITE_TOOL_NAMES = new Set([
  "heartgarden_patch_item",
  "heartgarden_create_item",
  "heartgarden_create_folder",
  "heartgarden_create_link",
  "heartgarden_update_link",
  "heartgarden_delete_item",
  "heartgarden_delete_link",
  "heartgarden_index_item",
]);

export function mcpContentTextTooLong(fieldLabel: string, text: string): string | null {
  if (typeof text !== "string") return null;
  if (text.length > MCP_MAX_CONTENT_TEXT_CHARS) {
    return `${fieldLabel} exceeds ${MCP_MAX_CONTENT_TEXT_CHARS} characters (split content or shorten before sending).`;
  }
  return null;
}

export function mcpSerializedPayloadTooLong(fieldLabel: string, value: unknown): string | null {
  try {
    const encoded = JSON.stringify(value) ?? "";
    if (encoded.length > MCP_MAX_CONTENT_TEXT_CHARS) {
      return `${fieldLabel} exceeds ${MCP_MAX_CONTENT_TEXT_CHARS} serialized characters (split content or shorten before sending).`;
    }
    return null;
  } catch {
    return `${fieldLabel} could not be serialized for size validation.`;
  }
}

function parseContentBlocks(raw: unknown): { ok: true; blocks: HgStructuredBlock[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: "content_blocks must be an array." };
  const blocks: HgStructuredBlock[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const candidate = raw[i];
    const parsed = hgStructuredBlockSchema.safeParse(candidate);
    if (!parsed.success) {
      return { ok: false, error: `mcp_invalid_content_blocks at index ${i}` };
    }
    blocks.push(parsed.data);
  }
  return { ok: true, blocks };
}

const MCP_CONTENT_BLOCK_SCHEMA = {
  oneOf: [
    {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["heading"] },
        level: { type: "integer", enum: [1, 2, 3] },
        text: { type: "string", minLength: 1, maxLength: 500 },
      },
      required: ["kind", "level", "text"],
    },
    {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["paragraph", "quote"] },
        text: { type: "string", minLength: 1, maxLength: 8000 },
      },
      required: ["kind", "text"],
    },
    {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["bullet_list", "ordered_list"] },
        items: {
          type: "array",
          items: { type: "string", minLength: 1, maxLength: 1200 },
          minItems: 1,
          maxItems: 200,
        },
      },
      required: ["kind", "items"],
    },
    {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["hr"] },
      },
      required: ["kind"],
    },
  ],
} as const;

const MCP_CONTENT_BLOCKS_INPUT_SCHEMA = {
  type: "array",
  items: MCP_CONTENT_BLOCK_SCHEMA,
  description:
    "Typed structured blocks array. Supports heading(level 1-3), paragraph, quote, bullet_list, ordered_list, hr.",
} as const;

function shouldRequireH1ForItemType(itemType: unknown): boolean {
  if (!itemType) return true;
  return itemType === "note" || itemType === "sticky" || itemType === "checklist";
}

/** Tool args from LLMs often use "true"/"1" instead of booleans. */
export function mcpCoerceTruthyFlag(v: unknown): boolean {
  return v === true || v === "true" || v === 1 || v === "1";
}

/** Use in inputSchema for optional space_id when tools fall back to HEARTGARDEN_DEFAULT_SPACE_ID. */
const MCP_SPACE_ID_OPTIONAL_HINT =
  "Space UUID. Required unless HEARTGARDEN_DEFAULT_SPACE_ID is set on this MCP process—call heartgarden_mcp_config to see if a default is configured.";

const MCP_ERR_MISSING_SPACE =
  "Missing space_id: pass space_id or set HEARTGARDEN_DEFAULT_SPACE_ID on the MCP process (check heartgarden_mcp_config).";

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

  const mcpApiTimeoutMs = (() => {
    const raw = (process.env.HEARTGARDEN_MCP_FETCH_TIMEOUT_MS ?? "").trim();
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 1000 && parsed <= 300_000) {
      return Math.floor(parsed);
    }
    return 30_000;
  })();

  const mcpLoreQueryTimeoutMs = (() => {
    const raw = (process.env.HEARTGARDEN_MCP_LORE_QUERY_TIMEOUT_MS ?? "").trim();
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 1000 && parsed <= 300_000) {
      return Math.floor(parsed);
    }
    return Math.max(mcpApiTimeoutMs, anthropicLlmDeadlineMs());
  })();

  const api = async (
    input: string | URL,
    init?: RequestInit,
    opts?: { timeoutMs?: number },
  ) => {
    const timeoutMs = opts?.timeoutMs ?? mcpApiTimeoutMs;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(new Error("MCP fetch timeout")), timeoutMs);
    try {
      return await fetch(input, {
        ...init,
        headers: mergeAuthHeaders(SERVICE_KEY, init?.headers),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };

  const mcpToolText = (text: string) => ({ content: [{ type: "text" as const, text }] });

  const mcpToolError = (
    code: string,
    message: string,
    extra?: { httpStatus?: number; retryAfter?: string | null },
  ) => ({
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            ok: false,
            error: message,
            code,
            ...(extra?.httpStatus != null ? { httpStatus: extra.httpStatus } : {}),
            ...(extra?.retryAfter ? { retryAfter: extra.retryAfter } : {}),
          },
          null,
          2,
        ),
      },
    ],
    isError: true,
  });

  const mcpApiError = async (res: Response, code: string) => {
    const bodyText = await res.text();
    console.error("[heartgarden MCP API error]", code, {
      status: res.status,
      bodyPreview: bodyText.slice(0, 1200),
    });
    return mcpToolError(
      code,
      res.status === 429 ? "Rate limited by API" : "API request failed",
      {
        httpStatus: res.status,
        retryAfter: res.headers.get("retry-after"),
      },
    );
  };

  const mcpApiText = async (res: Response, code: string) => {
    if (!res.ok) return mcpApiError(res, code);
    return mcpToolText(await res.text());
  };

  const server = new Server(
    { name: "heartgarden", version: packageJson.version },
    { capabilities: { tools: {}, resources: {} } },
  );

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    try {
      const res = await api(`${BASE}/api/spaces`);
      if (!res.ok) {
        const bodyText = await res.text();
        console.error("[heartgarden MCP list resources]", {
          status: res.status,
          bodyPreview: bodyText.slice(0, 1200),
        });
        throw new Error("Unable to list resources");
      }
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
    } catch (e) {
      console.error("[heartgarden MCP list resources failed]", e);
      throw new Error("Unable to list resources");
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
    } catch {
      return {
        contents: [
          {
            uri,
            mimeType: "text/plain",
            text: "Failed to read resource.",
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
        description:
          "List all spaces (id, name, parent). GET /api/spaces. Call this (or heartgarden_mcp_config) when you need a space UUID instead of assuming HEARTGARDEN_DEFAULT_SPACE_ID is set.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "heartgarden_mcp_config",
        description:
          "Return non-secret MCP runtime flags: whether a default space id is configured, whether write tools are allowed, and whether HEARTGARDEN_MCP_WRITE_KEY is set on the server (no values revealed). Call when unsure whether space_id can be omitted.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "heartgarden_space_summary",
        description: "Item and in-space link counts for one space. GET /api/spaces/:id/summary.",
        inputSchema: {
          type: "object",
          properties: {
            space_id: { type: "string", description: MCP_SPACE_ID_OPTIONAL_HINT },
          },
        },
      },
      {
        name: "heartgarden_list_items",
        description:
          "List canvas items in a space (GET /api/v1/items). Response includes total. Omit limit to fetch all items; use limit (max 1000) + offset to page.",
        inputSchema: {
          type: "object",
          properties: {
            space_id: {
              type: "string",
              description: MCP_SPACE_ID_OPTIONAL_HINT,
            },
            limit: {
              type: "integer",
              description: "Page size when set (1–1000, default 500). Omit for full list.",
            },
            offset: { type: "integer", description: "Skip rows when limit is set (default 0)" },
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
            space_id: { type: "string", description: MCP_SPACE_ID_OPTIONAL_HINT },
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
        description:
          "Nodes and edges (item_links) for a space. GET /api/spaces/:id/graph. Omit limit for the full graph; pass limit (max 2000) + offset to page nodes (edges only connect nodes on that page).",
        inputSchema: {
          type: "object",
          properties: {
            space_id: { type: "string", description: MCP_SPACE_ID_OPTIONAL_HINT },
            limit: {
              type: "integer",
              description: "Node page size when set (1–2000, default 500). Omit for full graph.",
            },
            offset: { type: "integer", description: "Node offset when limit is set (default 0)" },
          },
        },
      },
      {
        name: "heartgarden_get_item",
        description:
          "Fetch one item by id (REST v1). Legacy tools/call alias vigil_get_entity / heartgarden_get_entity maps here — do not use a separate get_entity tool.",
        inputSchema: {
          type: "object",
          properties: {
            item_id: { type: "string", description: "UUID of the item" },
          },
          required: ["item_id"],
        },
      },
      {
        name: "heartgarden_get_item_outline",
        description:
          "Return heading outline for one item's hgDoc body as [{ level, text, charCount }]. Headingless docs return a single level-1 row with the item title.",
        inputSchema: {
          type: "object",
          properties: {
            item_id: { type: "string", description: "UUID of the item" },
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
              description: MCP_SPACE_ID_OPTIONAL_HINT,
            },
          },
          required: ["item_id"],
        },
      },
      {
        name: "heartgarden_lore_query",
        description:
          "Q&A over the canvas: hybrid retrieval (FTS + vectors + graph neighbors) then Claude returns one synthesized answer plus source pointers. POST /api/lore/query. response_mode=text (default) returns natural language; response_mode=grounded_json returns validated citations for stricter agent workflows. For raw retrieved chunks (no synthesis) to feed your own reasoning, use heartgarden_semantic_search.",
        inputSchema: {
          type: "object",
          properties: {
            question: { type: "string" },
            space_id: { type: "string", description: "Optional: limit retrieval to this space UUID" },
            limit: { type: "integer", description: "Max sources 1–24, default 14" },
            response_mode: {
              type: "string",
              enum: ["text", "grounded_json"],
              description: "text (default) or grounded_json for cited-item contract output",
            },
          },
          required: ["question"],
        },
      },
      {
        name: "heartgarden_semantic_search",
        description:
          "Raw semantic chunk retrieval: GET /api/search/chunks returns ranked text snippets and item ids (no LLM synthesis). Use for evidence, citations, or building your own context. For a single Claude-written answer to a question, use heartgarden_lore_query. Requires embeddings. You must pass space_id, set HEARTGARDEN_DEFAULT_SPACE_ID on the MCP server, or set all_spaces: true (searches every space—use deliberately).",
        inputSchema: {
          type: "object",
          properties: {
            space_id: {
              type: "string",
              description: "Space UUID (recommended). Ignored when all_spaces is true.",
            },
            all_spaces: {
              type: "boolean",
              description: "When true, search all spaces (omit spaceId on the API).",
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
          "Chunk + embed one item and refresh lore summary/aliases (Anthropic). POST /api/items/:id/index. Rate-limited: on HTTP 429 the JSON body includes rate_limit (retry_after_seconds) and Retry-After header.",
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
        name: "heartgarden_patch_item",
        description:
          "PATCH an item (geometry, content, entity fields, move between spaces). Maps snake_case args to API camelCase. Requires write_key (or omit when HEARTGARDEN_MCP_WRITE_KEY is set on the MCP server). For prose edits use content_markdown (preferred) or content_blocks (typed). Resolution order: content_json > content_blocks > content_markdown > content_text. content_json is the stored document JSON — for lore cards this is also where structured fields live under hgArch (employer faction, locations, roster rows). Use heartgarden_create_link only for visible high-signal map relationships; do not add decorative wires for every related fact. Use content_json / hgArch when the relationship should be owned by the card template. content_text is capped at ~2M characters per request.",
        inputSchema: {
          type: "object",
          properties: {
            write_key: { type: "string", description: "Must match HEARTGARDEN_MCP_WRITE_KEY" },
            item_id: { type: "string" },
            title: { type: "string" },
            content_text: {
              type: "string",
              description: `Plain text body (max ${MCP_MAX_CONTENT_TEXT_CHARS} chars per request). Default choice for edits.`,
            },
            content_markdown: {
              type: "string",
              description:
                "Preferred prose input: markdown subset (#/##/###, lists, quote, hr, paragraphs). Converted to hgDoc.",
            },
            content_blocks: {
              ...MCP_CONTENT_BLOCKS_INPUT_SCHEMA,
            },
            content_json: {
              type: "object",
              description:
                'Full TipTap/hgArch document (same shape as stored on the item); root is usually { type: "doc", content: [...] }. Use only when replacing whole editor state; see docs/API.md PATCH /api/items and docs/CANVAS_LORE_NODE_PATTERNS.md.',
            },
            entity_type: { type: "string", description: "items.entity_type" },
            entity_meta: { description: "Replaces entity_meta JSON object" },
            entity_meta_merge: { description: "Shallow merge into entity_meta" },
            space_id: { type: "string", description: "Move item to this space UUID" },
            x: { type: "number" },
            y: { type: "number" },
            width: { type: "number" },
            height: { type: "number" },
            z_index: { type: "integer" },
            color: { type: "string" },
            item_type: {
              type: "string",
              enum: ["note", "sticky", "image", "checklist", "webclip", "folder"],
            },
            image_url: { type: "string" },
            image_meta: { description: "JSON object" },
            stack_id: { type: "string", description: "UUID or null to clear" },
            stack_order: { type: "integer" },
            base_updated_at: { type: "string", description: "ISO optimistic concurrency" },
          },
          required: ["item_id"],
        },
      },
      {
        name: "heartgarden_create_item",
        description:
          'Create a canvas item (POST /api/spaces/:id/items). canvas_item_type: note|sticky|image|checklist|webclip (not folder—use heartgarden_create_folder). For prose content prefer content_markdown (or content_blocks for typed control). Resolution order: content_json > content_blocks > content_markdown > content_text. Entity fields—pick one primary path: (1) lore_entity character|faction|location for built-in lore card shells on note/sticky—server generates template contentJson/HTML like the UI. (2) canonical_entity_kind (npc|location|faction|quest|item|lore|other) maps to items.entity_type via the registry when you are not using lore_entity. (3) entity_type is the raw DB string when you need a specific type. MCP sends entityType from lore_entity first, else entity_type; canonical_entity_kind is also sent but the API uses it only if entityType is still unset—avoid mixing lore_entity with redundant canonical_entity_kind. Legacy item_type character → note + lore character. content_text max ~2M characters per request.',
        inputSchema: {
          type: "object",
          properties: {
            write_key: {
              type: "string",
              description: "Must match HEARTGARDEN_MCP_WRITE_KEY; may be omitted if the MCP process has that env set",
            },
            space_id: { type: "string", description: "Target canvas space UUID (always pass if unsure—see heartgarden_mcp_config)" },
            canvas_item_type: {
              type: "string",
              enum: ["note", "sticky", "image", "checklist", "webclip", "folder"],
              description: "Maps to items.item_type. Use heartgarden_create_folder instead of folder.",
            },
            item_type: {
              type: "string",
              description: "Deprecated: use canvas_item_type. Value 'character' means note + lore character.",
            },
            title: { type: "string" },
            content_text: {
              type: "string",
              description: `Plain text (max ${MCP_MAX_CONTENT_TEXT_CHARS} chars per request)`,
            },
            content_json: {
              type: "object",
              description: "Full hgDoc/content JSON. Takes precedence over markdown/blocks/text.",
            },
            content_markdown: {
              type: "string",
              description: "Preferred prose input: markdown subset converted to hgDoc content_json.",
            },
            content_blocks: {
              ...MCP_CONTENT_BLOCKS_INPUT_SCHEMA,
            },
            lore_entity: {
              type: "string",
              enum: ["character", "faction", "location"],
              description:
                "Lore card shell (note/sticky only): sets entityType and lets the server synthesize the lore HTML/contentJson template.",
            },
            lore_variant: {
              type: "string",
              enum: ["v1", "v2", "v3", "v4", "v11"],
              description: "Shell layout variant when using lore_entity",
            },
            canonical_entity_kind: {
              type: "string",
              enum: ["npc", "location", "faction", "quest", "item", "lore", "other"],
              description:
                "Maps to persisted entity_type via registry when lore_entity and entity_type are not used to set entityType.",
            },
            entity_type: {
              type: "string",
              description: "Raw items.entity_type string (e.g. quest) when not using lore_entity as the primary path",
            },
            entity_meta: { description: "JSON object stored on the item" },
            x: { type: "number" },
            y: { type: "number" },
            color: { type: "string" },
            theme: { type: "string", enum: ["default", "code", "task"] },
            image_url: { type: "string" },
            image_meta: { description: "JSON object" },
            auto_index: { type: "boolean", description: "POST /api/items/:id/index after create" },
          },
          required: ["space_id", "title"],
        },
      },
      {
        name: "heartgarden_create_folder",
        description:
          "Create a folder card and child space (POST /api/spaces with parentSpaceId, then POST folder item on the parent canvas). Prefer this when a concept set is densely interrelated; folders reduce wire clutter and keep topology legible.",
        inputSchema: {
          type: "object",
          properties: {
            write_key: { type: "string" },
            space_id: { type: "string", description: "Parent space UUID" },
            title: { type: "string" },
            x: { type: "number" },
            y: { type: "number" },
            auto_index: { type: "boolean" },
          },
          required: ["space_id", "title"],
        },
      },
      {
        name: "heartgarden_create_link",
        description:
          "Create a canvas connection between two items (POST /api/item-links): a visible thread/edge on the map. This is not the same as editing structured fields on a lore card (roster, anchors) — those live in the item's content JSON (hgArch) via heartgarden_patch_item. source_item_id → target_item_id. relationship_type maps to linkType. Canonical values: bond, affiliation, contract, conflict, history (pin is default rope). Legacy values are normalized server-side. Use links intentionally (high-signal relationships), not as full-mesh wiring for every related fact. If many cards are tightly related under one idea, prefer a folder/subspace and a few bridge links. Pins are omitted so the UI picks default anchors; duplicate logical pairs can exist with different pin geometry. Both items must share space_id.",
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
            relationship_type: {
              type: "string",
              description:
                "Stored as linkType. Prefer: bond | affiliation | contract | conflict | history",
            },
          },
          required: ["space_id", "source_item_id", "target_item_id"],
        },
      },
      {
        name: "heartgarden_update_link",
        description:
          "PATCH an existing item_link (PATCH /api/item-links): label, relationship_type (maps to linkType), or color. Prefer canonical relationship_type: bond | affiliation | contract | conflict | history.",
        inputSchema: {
          type: "object",
          properties: {
            write_key: {
              type: "string",
              description: "Must match HEARTGARDEN_MCP_WRITE_KEY; may be omitted if the MCP process has that env set",
            },
            link_id: { type: "string", description: "item_links row UUID" },
            label: { type: "string", description: "Edge label; omit to leave unchanged" },
            relationship_type: {
              type: "string",
              description:
                "Maps to linkType. Canonical: bond | affiliation | contract | conflict | history",
            },
            color: { type: "string", description: "Edge color token" },
          },
          required: ["link_id"],
        },
      },
      {
        name: "heartgarden_delete_item",
        description:
          "Delete a canvas item and its embeddings / incident links (DELETE /api/items/:id). Irreversible.",
        inputSchema: {
          type: "object",
          properties: {
            write_key: {
              type: "string",
              description: "Must match HEARTGARDEN_MCP_WRITE_KEY; may be omitted if the MCP process has that env set",
            },
            item_id: { type: "string", description: "Item UUID" },
          },
          required: ["item_id"],
        },
      },
      {
        name: "heartgarden_delete_link",
        description: "Delete one item_link by id (DELETE /api/item-links with JSON body).",
        inputSchema: {
          type: "object",
          properties: {
            write_key: {
              type: "string",
              description: "Must match HEARTGARDEN_MCP_WRITE_KEY; may be omitted if the MCP process has that env set",
            },
            link_id: { type: "string", description: "item_links row UUID" },
          },
          required: ["link_id"],
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

    if (config.readOnly && HEARTGARDEN_MCP_WRITE_TOOL_NAMES.has(name)) {
      return {
        content: [
          {
            type: "text",
            text: "This MCP server is in read-only mode (HEARTGARDEN_MCP_READ_ONLY=1). Write tools are disabled.",
          },
        ],
        isError: true,
      };
    }

    if (name === "heartgarden_browse_spaces") {
      const res = await api(`${BASE}/api/spaces`);
      if (!res.ok) return mcpApiError(res, "mcp_browse_spaces_failed");
      const text = await res.text();
      try {
        const data = JSON.parse(text) as { spaces?: unknown[] };
        if (data && Array.isArray(data.spaces)) {
          data.spaces = filterGmSpaces(data.spaces, config.playerSpaceExcluded, config.gmBreakGlass);
          return mcpToolText(JSON.stringify(data));
        }
      } catch {
        /* passthrough */
      }
      return mcpToolText(text);
    }

    if (name === "heartgarden_mcp_config") {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                default_space_configured: SPACE.length > 0,
                mcp_read_only: config.readOnly,
                write_key_configured: WRITE_KEY.length > 0,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    if (name === "heartgarden_space_summary") {
      const spaceId = String(args.space_id ?? "").trim() || SPACE;
      if (!spaceId) {
        return {
          content: [{ type: "text", text: MCP_ERR_MISSING_SPACE }],
          isError: true,
        };
      }
      const res = await api(`${BASE}/api/spaces/${encodeURIComponent(spaceId)}/summary`);
      return mcpApiText(res, "mcp_space_summary_failed");
    }

    if (name === "heartgarden_list_items") {
      const spaceId = (args.space_id as string | undefined) || SPACE;
      if (!spaceId) {
        return {
          content: [
            { type: "text", text: MCP_ERR_MISSING_SPACE },
          ],
          isError: true,
        };
      }
      const qs = new URLSearchParams();
      qs.set("space_id", String(spaceId));
      if (args.limit != null) qs.set("limit", String(args.limit));
      if (args.offset != null) qs.set("offset", String(args.offset));
      const res = await api(`${BASE}/api/v1/items?${qs.toString()}`);
      return mcpApiText(res, "mcp_list_items_failed");
    }

    if (name === "heartgarden_search") {
      const spaceId = (args.space_id as string | undefined) || SPACE;
      const q = String(args.q ?? "").trim();
      const mode = (args.mode as string | undefined) || "hybrid";
      if (!spaceId) {
        return {
          content: [
            { type: "text", text: MCP_ERR_MISSING_SPACE },
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
      return mcpApiText(res, "mcp_search_failed");
    }

    if (name === "heartgarden_graph") {
      const spaceId = (args.space_id as string | undefined) || SPACE;
      if (!spaceId) {
        return {
          content: [
            { type: "text", text: MCP_ERR_MISSING_SPACE },
          ],
          isError: true,
        };
      }
      const qs = new URLSearchParams();
      if (args.limit != null) qs.set("limit", String(args.limit));
      if (args.offset != null) qs.set("offset", String(args.offset));
      const q = qs.toString();
      const res = await api(
        `${BASE}/api/spaces/${encodeURIComponent(String(spaceId))}/graph${q ? `?${q}` : ""}`,
      );
      return mcpApiText(res, "mcp_graph_failed");
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
      return mcpApiText(res, "mcp_get_item_failed");
    }

    if (name === "heartgarden_get_item_outline") {
      const itemId = String(args.item_id ?? "").trim();
      if (!itemId) {
        return {
          content: [{ type: "text", text: "item_id is required" }],
          isError: true,
        };
      }
      const res = await api(`${BASE}/api/v1/items/${encodeURIComponent(itemId)}`);
      if (!res.ok) return mcpApiError(res, "mcp_get_item_outline_failed");
      const payload = (await res.json()) as {
        item?: { title?: string; contentJson?: Record<string, unknown> | null; contentText?: string | null };
      };
      const item = payload.item;
      if (!item) return mcpToolText(JSON.stringify({ ok: false, error: "Item not found" }, null, 2));
      const title = String(item.title ?? "").trim() || "Untitled";
      const contentJson = (item.contentJson as Record<string, unknown> | null) ?? null;
      let outline: Array<{ level: 1 | 2 | 3; text: string; charCount: number }> = [];
      if (isHgDocContentJson(contentJson)) {
        const sections = deriveSectionsFromHgDoc(readHgDocFromContentJson(contentJson), title);
        outline = sections.map((section, index) => ({
          level: index === 0 ? 1 : ((Math.min(3, section.headingPath.length) || 1) as 1 | 2 | 3),
          text: section.headingPath[section.headingPath.length - 1] ?? title,
          charCount: section.text.length,
        }));
      } else {
        const bodyLen = String(item.contentText ?? "").trim().length;
        outline = [{ level: 1, text: title, charCount: bodyLen }];
      }
      return mcpToolText(JSON.stringify({ ok: true, itemId, outline }, null, 2));
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
      return mcpApiText(res, "mcp_item_links_failed");
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
      return mcpApiText(res, "mcp_related_items_failed");
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
            { type: "text", text: MCP_ERR_MISSING_SPACE },
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
      return mcpApiText(res, "mcp_title_mentions_failed");
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
      if (args.response_mode === "grounded_json" || args.response_mode === "text") {
        body.responseMode = args.response_mode;
      }
      let res: Response;
      try {
        res = await api(
          `${BASE}/api/lore/query`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
          { timeoutMs: mcpLoreQueryTimeoutMs },
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "MCP lore query failed";
        const timeout =
          msg.includes("MCP fetch timeout") ||
          msg.includes("aborted") ||
          msg.includes("AbortError");
        return mcpToolError(
          timeout ? "mcp_lore_query_timeout" : "mcp_lore_query_transport_error",
          timeout
            ? `Lore query timed out after ${mcpLoreQueryTimeoutMs}ms`
            : "Lore query transport error",
        );
      }
      if (!res.ok) {
        const bodyText = await res.text();
        const mappedCode =
          res.status === 429
            ? "mcp_lore_query_rate_limited"
            : res.status >= 500
              ? "mcp_lore_query_upstream_error"
              : "mcp_lore_query_failed";
        console.error("[heartgarden MCP API error]", mappedCode, {
          status: res.status,
          bodyPreview: bodyText.slice(0, 1200),
        });
        return mcpToolError(
          mappedCode,
          res.status === 429 ? "Rate limited by lore query API" : "Lore query API request failed",
          {
            httpStatus: res.status,
            retryAfter: res.headers.get("retry-after"),
          },
        );
      }
      return mcpToolText(await res.text());
    }

    if (name === "heartgarden_semantic_search") {
      const allSpaces = mcpCoerceTruthyFlag(args.all_spaces);
      const explicitSpace = args.space_id ? String(args.space_id).trim() : "";
      const q = String(args.q ?? "").trim();
      if (q.length < 2) {
        return {
          content: [{ type: "text", text: "Query q must be at least 2 characters." }],
          isError: true,
        };
      }
      if (!allSpaces && !explicitSpace && !SPACE) {
        return {
          content: [
            {
              type: "text",
              text: "Provide space_id, set HEARTGARDEN_DEFAULT_SPACE_ID on the MCP server (see heartgarden_mcp_config), or pass all_spaces: true to search every space.",
            },
          ],
          isError: true,
        };
      }
      const url = new URL("/api/search/chunks", BASE);
      if (!allSpaces) {
        const sid = explicitSpace || SPACE;
        if (sid) url.searchParams.set("spaceId", sid);
      }
      url.searchParams.set("q", q);
      if (args.limit != null) url.searchParams.set("limit", String(args.limit));
      const res = await api(url);
      return mcpApiText(res, "mcp_semantic_search_failed");
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
      return mcpApiText(res, "mcp_index_item_failed");
    }

    if (name === "heartgarden_patch_item") {
      const wkErr = mcpWriteKeyError(args, WRITE_KEY, { allowOmitWhenConfigSet: true });
      if (wkErr) {
        return { content: [{ type: "text", text: wkErr }], isError: true };
      }
      const itemId = String(args.item_id ?? "").trim();
      if (!itemId) {
        return {
          content: [{ type: "text", text: "item_id is required" }],
          isError: true,
        };
      }
      if (typeof args.content_text === "string") {
        const tooLong = mcpContentTextTooLong("content_text", args.content_text);
        if (tooLong) {
          return { content: [{ type: "text", text: tooLong }], isError: true };
        }
      }
      if (typeof args.content_markdown === "string") {
        const tooLong = mcpContentTextTooLong("content_markdown", args.content_markdown);
        if (tooLong) {
          return { content: [{ type: "text", text: tooLong }], isError: true };
        }
      }
      if (args.content_blocks != null) {
        const tooLong = mcpSerializedPayloadTooLong("content_blocks", args.content_blocks);
        if (tooLong) {
          return { content: [{ type: "text", text: tooLong }], isError: true };
        }
      }
      if (args.content_json != null && typeof args.content_json === "object") {
        const tooLong = mcpSerializedPayloadTooLong("content_json", args.content_json);
        if (tooLong) {
          return { content: [{ type: "text", text: tooLong }], isError: true };
        }
      }
      const hasExplicitJson =
        args.content_json != null &&
        typeof args.content_json === "object";
      const markdownInput = typeof args.content_markdown === "string" ? args.content_markdown : "";
      const hasMarkdown = markdownInput.trim().length > 0;
      const hasBlocks = Array.isArray(args.content_blocks);
      let structureReport: Record<string, unknown> | undefined;
      let structuredDoc: Record<string, unknown> | undefined;
      let structuredText: string | undefined;
      if (!hasExplicitJson && hasBlocks) {
        const parsed = parseContentBlocks(args.content_blocks);
        if (!parsed.ok) {
          return { content: [{ type: "text", text: parsed.error }], isError: true };
        }
        const built = structuredBodyToHgDoc(
          { blocks: parsed.blocks },
          {
            title: typeof args.title === "string" ? args.title : undefined,
            requireH1: shouldRequireH1ForItemType(args.item_type),
          },
        );
        structuredDoc = { format: "hgDoc", doc: built.doc };
        structuredText = built.plainText;
        structureReport = built.structureReport as unknown as Record<string, unknown>;
      } else if (!hasExplicitJson && hasMarkdown) {
        const body = markdownToStructuredBody(markdownInput, {
          title: typeof args.title === "string" ? args.title : undefined,
          requireH1: shouldRequireH1ForItemType(args.item_type),
        });
        const built = structuredBodyToHgDoc(body, {
          title: typeof args.title === "string" ? args.title : undefined,
          requireH1: shouldRequireH1ForItemType(args.item_type),
        });
        structuredDoc = { format: "hgDoc", doc: built.doc };
        structuredText = built.plainText;
        structureReport = built.structureReport as unknown as Record<string, unknown>;
      }
      const patch: Record<string, unknown> = {};
      if (typeof args.title === "string") patch.title = args.title;
      if (typeof args.content_text === "string") patch.contentText = args.content_text;
      if (structuredText && typeof args.content_text !== "string") {
        patch.contentText = structuredText;
      }
      if (args.content_json != null && typeof args.content_json === "object") {
        patch.contentJson = args.content_json as Record<string, unknown>;
      } else if (structuredDoc) {
        patch.contentJson = structuredDoc;
      }
      if (typeof args.entity_type === "string") patch.entityType = args.entity_type;
      if (args.entity_meta != null && typeof args.entity_meta === "object") {
        patch.entityMeta = args.entity_meta as Record<string, unknown>;
      }
      if (args.entity_meta_merge != null && typeof args.entity_meta_merge === "object") {
        patch.entityMetaMerge = args.entity_meta_merge as Record<string, unknown>;
      }
      if (typeof args.space_id === "string" && args.space_id.trim()) patch.spaceId = args.space_id.trim();
      if (typeof args.x === "number") patch.x = args.x;
      if (typeof args.y === "number") patch.y = args.y;
      if (typeof args.width === "number") patch.width = args.width;
      if (typeof args.height === "number") patch.height = args.height;
      if (typeof args.z_index === "number") patch.zIndex = args.z_index;
      if (typeof args.color === "string") patch.color = args.color;
      if (
        args.item_type === "note" ||
        args.item_type === "sticky" ||
        args.item_type === "image" ||
        args.item_type === "checklist" ||
        args.item_type === "webclip" ||
        args.item_type === "folder"
      ) {
        patch.itemType = args.item_type;
      }
      if (typeof args.image_url === "string") patch.imageUrl = args.image_url;
      if (args.image_meta != null && typeof args.image_meta === "object") {
        patch.imageMeta = args.image_meta as Record<string, unknown>;
      }
      if (args.stack_id === null) {
        patch.stackId = null;
      } else if (typeof args.stack_id === "string" && args.stack_id.trim()) {
        patch.stackId = args.stack_id.trim();
      }
      if (args.stack_order === null) {
        patch.stackOrder = null;
      } else if (typeof args.stack_order === "number") {
        patch.stackOrder = args.stack_order;
      }
      if (typeof args.base_updated_at === "string" && args.base_updated_at.trim()) {
        patch.baseUpdatedAt = args.base_updated_at.trim();
      }
      if (Object.keys(patch).length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "Provide at least one field to patch (title, content_text, geometry, entity_*, space_id, …)",
            },
          ],
          isError: true,
        };
      }
      const res = await api(`${BASE}/api/items/${encodeURIComponent(itemId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!structureReport) return mcpApiText(res, "mcp_patch_item_failed");
      if (!res.ok) return mcpApiError(res, "mcp_patch_item_failed");
      const text = await res.text();
      try {
        const parsed = JSON.parse(text) as Record<string, unknown>;
        return mcpToolText(JSON.stringify({ ...parsed, structure_report: structureReport }, null, 2));
      } catch {
        return mcpToolText(
          JSON.stringify({ ok: true, raw: text, structure_report: structureReport }, null, 2),
        );
      }
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
      const title = String(args.title ?? "").trim();
      if (!title) {
        return { content: [{ type: "text", text: "title is required" }], isError: true };
      }

      const canvasRaw = String(args.canvas_item_type ?? "").trim();
      const legacyRaw = String(args.item_type ?? "").trim();
      let itemType = canvasRaw || legacyRaw;
      if (!itemType) {
        return {
          content: [{ type: "text", text: "canvas_item_type is required (or legacy item_type)" }],
          isError: true,
        };
      }

      if (itemType === "character") {
        itemType = "note";
      }
      if (itemType === "folder") {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ok: false,
                error: "Use heartgarden_create_folder to create folder cards (child space + item).",
              }),
            },
          ],
          isError: true,
        };
      }

      const validItemTypes = ["note", "sticky", "image", "checklist", "webclip"];
      if (!validItemTypes.includes(itemType)) {
        return {
          content: [{ type: "text", text: `Invalid canvas_item_type: ${itemType}` }],
          isError: true,
        };
      }

      const loreEntity = String(args.lore_entity ?? "").trim();
      const legacyCharacter = legacyRaw === "character" || canvasRaw === "character";
      let resolvedLore: string | undefined;
      if (loreEntity === "character" || loreEntity === "faction" || loreEntity === "location") {
        resolvedLore = loreEntity;
      } else if (legacyCharacter) {
        resolvedLore = "character";
      }

      if (
        resolvedLore &&
        itemType !== "note" &&
        itemType !== "sticky"
      ) {
        return {
          content: [
            {
              type: "text",
              text: "lore_entity requires canvas_item_type note or sticky",
            },
          ],
          isError: true,
        };
      }

      const contentText = typeof args.content_text === "string" ? args.content_text : "";
      if (typeof args.content_markdown === "string") {
        const tooLong = mcpContentTextTooLong("content_markdown", args.content_markdown);
        if (tooLong) {
          return { content: [{ type: "text", text: tooLong }], isError: true };
        }
      }
      if (args.content_blocks != null) {
        const tooLong = mcpSerializedPayloadTooLong("content_blocks", args.content_blocks);
        if (tooLong) {
          return { content: [{ type: "text", text: tooLong }], isError: true };
        }
      }
      if (args.content_json != null && typeof args.content_json === "object") {
        const tooLong = mcpSerializedPayloadTooLong("content_json", args.content_json);
        if (tooLong) {
          return { content: [{ type: "text", text: tooLong }], isError: true };
        }
      }
      const markdownInput = typeof args.content_markdown === "string" ? args.content_markdown : "";
      const hasMarkdown = markdownInput.trim().length > 0;
      const hasBlocks = Array.isArray(args.content_blocks);
      const hasContentJsonArg = args.content_json != null && typeof args.content_json === "object";
      let structureReport: Record<string, unknown> | undefined;
      let structuredDoc: Record<string, unknown> | undefined;
      let structuredText: string | undefined;
      if (!hasContentJsonArg && !resolvedLore && hasBlocks) {
        const parsed = parseContentBlocks(args.content_blocks);
        if (!parsed.ok) {
          return { content: [{ type: "text", text: parsed.error }], isError: true };
        }
        const built = structuredBodyToHgDoc(
          { blocks: parsed.blocks },
          {
            title,
            requireH1: shouldRequireH1ForItemType(itemType),
          },
        );
        structuredDoc = { format: "hgDoc", doc: built.doc };
        structuredText = built.plainText;
        structureReport = built.structureReport as unknown as Record<string, unknown>;
      } else if (!hasContentJsonArg && !resolvedLore && hasMarkdown) {
        const body = markdownToStructuredBody(markdownInput, {
          title,
          requireH1: shouldRequireH1ForItemType(itemType),
        });
        const built = structuredBodyToHgDoc(body, {
          title,
          requireH1: shouldRequireH1ForItemType(itemType),
        });
        structuredDoc = { format: "hgDoc", doc: built.doc };
        structuredText = built.plainText;
        structureReport = built.structureReport as unknown as Record<string, unknown>;
      }
      const contentLenErr = mcpContentTextTooLong("content_text", contentText);
      if (contentLenErr) {
        return { content: [{ type: "text", text: contentLenErr }], isError: true };
      }
      if (
        itemType === "note" &&
        contentText.trim() === "" &&
        !hasMarkdown &&
        !hasBlocks &&
        !hasContentJsonArg &&
        !resolvedLore &&
        !args.canonical_entity_kind &&
        !String(args.entity_type ?? "").trim()
      ) {
        return {
          content: [
            {
              type: "text",
              text:
                "content_text is required for plain notes (or set lore_entity, canonical_entity_kind, or entity_type)",
            },
          ],
          isError: true,
        };
      }

      const body: Record<string, unknown> = {
        itemType,
        title,
        contentText: contentText || structuredText || "",
        x: typeof args.x === "number" ? args.x : 0,
        y: typeof args.y === "number" ? args.y : 0,
      };
      if (hasContentJsonArg) {
        body.contentJson = args.content_json as Record<string, unknown>;
      } else if (structuredDoc) {
        body.contentJson = structuredDoc;
      }

      if (resolvedLore) {
        body.entityType = resolvedLore;
      } else if (typeof args.entity_type === "string" && args.entity_type.trim()) {
        body.entityType = args.entity_type.trim();
      }
      if (typeof args.canonical_entity_kind === "string" && args.canonical_entity_kind.trim()) {
        body.canonical_entity_kind = args.canonical_entity_kind.trim();
      }
      if (
        args.lore_variant === "v1" ||
        args.lore_variant === "v2" ||
        args.lore_variant === "v3" ||
        args.lore_variant === "v11"
      ) {
        body.lore_variant = args.lore_variant;
      }
      if (typeof args.color === "string" && args.color.trim()) body.color = args.color.trim();
      if (args.theme === "default" || args.theme === "code" || args.theme === "task") {
        body.theme = args.theme;
      }
      if (typeof args.image_url === "string" && args.image_url.trim()) body.imageUrl = args.image_url.trim();
      if (args.image_meta != null && typeof args.image_meta === "object") {
        body.imageMeta = args.image_meta as Record<string, unknown>;
      }
      if (args.entity_meta != null && typeof args.entity_meta === "object") {
        body.entityMeta = args.entity_meta as Record<string, unknown>;
      }

      const res = await api(`${BASE}/api/spaces/${encodeURIComponent(spaceId)}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return mcpApiError(res, "mcp_create_item_failed");
      const createText = await res.text();
      if (args.auto_index !== true) {
        if (!structureReport) {
          return { content: [{ type: "text", text: createText }] };
        }
        try {
          const created = JSON.parse(createText) as Record<string, unknown>;
          return mcpToolText(JSON.stringify({ ...created, structure_report: structureReport }, null, 2));
        } catch {
          return mcpToolText(
            JSON.stringify({ ok: true, raw: createText, structure_report: structureReport }, null, 2),
          );
        }
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
        if (!idxRes.ok) return mcpApiError(idxRes, "mcp_create_item_index_failed");
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
              text: JSON.stringify(
                {
                  create: created,
                  index: indexPayload,
                  ...(structureReport ? { structure_report: structureReport } : {}),
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch {
        return { content: [{ type: "text", text: createText }] };
      }
    }

    if (name === "heartgarden_create_folder") {
      const wkErr = mcpWriteKeyError(args, WRITE_KEY, { allowOmitWhenConfigSet: true });
      if (wkErr) {
        return { content: [{ type: "text", text: wkErr }], isError: true };
      }
      const parentSpaceId = String(args.space_id ?? "").trim();
      const title = String(args.title ?? "").trim();
      if (!parentSpaceId || !title) {
        return {
          content: [{ type: "text", text: "space_id and title are required" }],
          isError: true,
        };
      }
      const spaceRes = await api(`${BASE}/api/spaces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: title, parentSpaceId }),
      });
      if (!spaceRes.ok) return mcpApiError(spaceRes, "mcp_create_folder_space_failed");
      const spaceText = await spaceRes.text();
      let childSpaceId = "";
      try {
        const sj = JSON.parse(spaceText) as { ok?: boolean; space?: { id?: string } };
        if (sj?.ok && sj.space?.id) childSpaceId = sj.space.id;
      } catch {
        /* below */
      }
      if (!childSpaceId) {
        return { content: [{ type: "text", text: spaceText }], isError: true };
      }
      const rotation = (Math.random() - 0.5) * 4;
      const folderContentJson = {
        folder: { childSpaceId },
        hgArch: { rotation, tapeRotation: 0 },
      };
      const itemRes = await api(`${BASE}/api/spaces/${encodeURIComponent(parentSpaceId)}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemType: "folder",
          x: typeof args.x === "number" ? args.x : 0,
          y: typeof args.y === "number" ? args.y : 0,
          width: 420,
          height: 280,
          title,
          contentText: title,
          contentJson: folderContentJson,
        }),
      });
      if (!itemRes.ok) return mcpApiError(itemRes, "mcp_create_folder_item_failed");
      const itemText = await itemRes.text();
      if (args.auto_index !== true) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { space: JSON.parse(spaceText) as object, item: JSON.parse(itemText) as object },
                null,
                2,
              ),
            },
          ],
        };
      }
      try {
        const itemJson = JSON.parse(itemText) as { ok?: boolean; item?: { id?: string } };
        const newId = itemJson?.item?.id;
        if (!itemJson?.ok || !newId) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ space: JSON.parse(spaceText), item: itemJson }, null, 2),
              },
            ],
          };
        }
        const idxRes = await api(`${BASE}/api/items/${encodeURIComponent(newId)}/index`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!idxRes.ok) return mcpApiError(idxRes, "mcp_create_folder_index_failed");
        const indexText = await idxRes.text();
        let indexPayload: unknown = indexText;
        try {
          indexPayload = JSON.parse(indexText);
        } catch {
          /* raw */
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  space: JSON.parse(spaceText),
                  item: itemJson,
                  index: indexPayload,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ space: JSON.parse(spaceText), rawItem: itemText }, null, 2),
            },
          ],
        };
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
        linkBody.linkType = normalizeLinkTypeAlias(args.relationship_type.trim());
      }
      const res = await api(`${BASE}/api/item-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(linkBody),
      });
      return mcpApiText(res, "mcp_create_link_failed");
    }

    if (name === "heartgarden_update_link") {
      const wkErr = mcpWriteKeyError(args, WRITE_KEY, { allowOmitWhenConfigSet: true });
      if (wkErr) {
        return { content: [{ type: "text", text: wkErr }], isError: true };
      }
      const linkId = String(args.link_id ?? "").trim();
      if (!linkId) {
        return { content: [{ type: "text", text: "link_id is required" }], isError: true };
      }
      const patchBody: Record<string, unknown> = { id: linkId };
      if (args.label !== undefined) patchBody.label = args.label;
      const relRaw = args.relationship_type;
      if (relRaw !== undefined && relRaw !== null) {
        const rel = String(relRaw).trim();
        if (rel) patchBody.linkType = normalizeLinkTypeAlias(rel);
      }
      if (args.color !== undefined) patchBody.color = args.color;
      if (Object.keys(patchBody).length < 2) {
        return {
          content: [
            {
              type: "text",
              text: "Provide at least one of label, relationship_type, or color to update",
            },
          ],
          isError: true,
        };
      }
      const res = await api(`${BASE}/api/item-links`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });
      return mcpApiText(res, "mcp_update_link_failed");
    }

    if (name === "heartgarden_delete_item") {
      const wkErr = mcpWriteKeyError(args, WRITE_KEY, { allowOmitWhenConfigSet: true });
      if (wkErr) {
        return { content: [{ type: "text", text: wkErr }], isError: true };
      }
      const itemId = String(args.item_id ?? "").trim();
      if (!itemId) {
        return { content: [{ type: "text", text: "item_id is required" }], isError: true };
      }
      const res = await api(`${BASE}/api/items/${encodeURIComponent(itemId)}`, {
        method: "DELETE",
      });
      return mcpApiText(res, "mcp_delete_item_failed");
    }

    if (name === "heartgarden_delete_link") {
      const wkErr = mcpWriteKeyError(args, WRITE_KEY, { allowOmitWhenConfigSet: true });
      if (wkErr) {
        return { content: [{ type: "text", text: wkErr }], isError: true };
      }
      const linkId = String(args.link_id ?? "").trim();
      if (!linkId) {
        return { content: [{ type: "text", text: "link_id is required" }], isError: true };
      }
      const res = await api(`${BASE}/api/item-links`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: linkId }),
      });
      return mcpApiText(res, "mcp_delete_link_failed");
    }

    return {
      content: [{ type: "text", text: "Unknown tool" }],
      isError: true,
    };
  });

  return server;
}
