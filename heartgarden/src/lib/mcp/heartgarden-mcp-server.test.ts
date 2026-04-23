import { afterEach, describe, expect, it } from "vitest";

import {
  canonicalHeartgardenMcpToolName,
  mcpCoerceTruthyFlag,
  mcpContentTextTooLong,
  mcpSerializedPayloadTooLong,
  mcpWriteKeyError,
  MCP_MAX_CONTENT_TEXT_CHARS,
  resolveHeartgardenMcpBaseUrl,
} from "./heartgarden-mcp-server";

describe("canonicalHeartgardenMcpToolName", () => {
  it("maps vigil_ tool names to heartgarden_ (legacy tools/call aliases)", () => {
    const pairs: [string, string][] = [
      ["vigil_browse_spaces", "heartgarden_browse_spaces"],
      ["vigil_mcp_config", "heartgarden_mcp_config"],
      ["vigil_space_summary", "heartgarden_space_summary"],
      ["vigil_list_items", "heartgarden_list_items"],
      ["vigil_search", "heartgarden_search"],
      ["vigil_graph", "heartgarden_graph"],
      ["vigil_get_item", "heartgarden_get_item"],
      ["vigil_get_item_outline", "heartgarden_get_item_outline"],
      ["vigil_get_entity", "heartgarden_get_entity"],
      ["vigil_item_links", "heartgarden_item_links"],
      ["vigil_traverse_links", "heartgarden_traverse_links"],
      ["vigil_related_items", "heartgarden_related_items"],
      ["vigil_title_mentions", "heartgarden_title_mentions"],
      ["vigil_lore_query", "heartgarden_lore_query"],
      ["vigil_semantic_search", "heartgarden_semantic_search"],
      ["vigil_index_item", "heartgarden_index_item"],
      ["vigil_patch_item", "heartgarden_patch_item"],
      ["vigil_create_item", "heartgarden_create_item"],
      ["vigil_create_link", "heartgarden_create_link"],
      ["vigil_create_folder", "heartgarden_create_folder"],
      ["vigil_update_link", "heartgarden_update_link"],
      ["vigil_delete_item", "heartgarden_delete_item"],
      ["vigil_delete_link", "heartgarden_delete_link"],
    ];
    for (const [legacy, canonical] of pairs) {
      expect(canonicalHeartgardenMcpToolName(legacy)).toBe(canonical);
    }
  });

  it("trims whitespace before mapping", () => {
    expect(canonicalHeartgardenMcpToolName("  vigil_search  ")).toBe("heartgarden_search");
  });

  it("passes through canonical heartgarden_ names unchanged", () => {
    expect(canonicalHeartgardenMcpToolName("heartgarden_search")).toBe("heartgarden_search");
  });

  it("does not rewrite unrelated tool names", () => {
    expect(canonicalHeartgardenMcpToolName("other_connector_tool")).toBe("other_connector_tool");
  });
});

describe("mcpCoerceTruthyFlag", () => {
  it("treats common LLM truthy forms as true", () => {
    expect(mcpCoerceTruthyFlag(true)).toBe(true);
    expect(mcpCoerceTruthyFlag("true")).toBe(true);
    expect(mcpCoerceTruthyFlag(1)).toBe(true);
    expect(mcpCoerceTruthyFlag("1")).toBe(true);
  });
  it("rejects other values", () => {
    expect(mcpCoerceTruthyFlag(false)).toBe(false);
    expect(mcpCoerceTruthyFlag("false")).toBe(false);
    expect(mcpCoerceTruthyFlag(undefined)).toBe(false);
    expect(mcpCoerceTruthyFlag(0)).toBe(false);
  });
});

describe("mcpWriteKeyError", () => {
  it("returns error when server key is unset", () => {
    expect(mcpWriteKeyError({}, "", { allowOmitWhenConfigSet: true })).toMatch(/not set/);
  });
  it("allows omit when configured and allowOmitWhenConfigSet", () => {
    expect(mcpWriteKeyError({}, "secret", { allowOmitWhenConfigSet: true })).toBe(null);
  });
  it("rejects wrong key", () => {
    expect(mcpWriteKeyError({ write_key: "bad" }, "good", { allowOmitWhenConfigSet: true })).toBe(
      "Invalid write_key",
    );
  });
  it("requires explicit key when omit not allowed", () => {
    expect(mcpWriteKeyError({}, "secret", { allowOmitWhenConfigSet: false })).toMatch(/required/);
  });
});

describe("mcp payload size guards", () => {
  it("caps content_text by max chars", () => {
    const within = "a".repeat(MCP_MAX_CONTENT_TEXT_CHARS);
    const over = "a".repeat(MCP_MAX_CONTENT_TEXT_CHARS + 1);
    expect(mcpContentTextTooLong("content_text", within)).toBeNull();
    expect(mcpContentTextTooLong("content_text", over)).toMatch(/exceeds/);
  });

  it("caps serialized structured payloads", () => {
    const within = { text: "a".repeat(16) };
    expect(mcpSerializedPayloadTooLong("content_json", within)).toBeNull();
    const over = { text: "a".repeat(MCP_MAX_CONTENT_TEXT_CHARS + 8) };
    expect(mcpSerializedPayloadTooLong("content_json", over)).toMatch(/serialized/);
  });
});

describe("resolveHeartgardenMcpBaseUrl", () => {
  afterEach(() => {
    delete process.env.HEARTGARDEN_APP_URL;
    delete process.env.VERCEL_URL;
  });

  it("prefers HEARTGARDEN_APP_URL", () => {
    process.env.HEARTGARDEN_APP_URL = "https://example.com/";
    expect(resolveHeartgardenMcpBaseUrl()).toBe("https://example.com");
  });

  it("uses VERCEL_URL when app URL unset", () => {
    process.env.VERCEL_URL = "my-app.vercel.app";
    expect(resolveHeartgardenMcpBaseUrl()).toBe("https://my-app.vercel.app");
  });

  it("uses request host when env unset", () => {
    const req = new Request("https://deployed.example/api/mcp", {
      headers: { host: "deployed.example", "x-forwarded-proto": "https" },
    });
    expect(resolveHeartgardenMcpBaseUrl(req)).toBe("https://deployed.example");
  });
});
