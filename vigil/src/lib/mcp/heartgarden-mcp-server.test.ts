import { afterEach, describe, expect, it } from "vitest";

import {
  canonicalHeartgardenMcpToolName,
  resolveHeartgardenMcpBaseUrl,
} from "./heartgarden-mcp-server";

describe("canonicalHeartgardenMcpToolName", () => {
  it("maps vigil_ tool names to heartgarden_ (legacy tools/call aliases)", () => {
    const pairs: [string, string][] = [
      ["vigil_browse_spaces", "heartgarden_browse_spaces"],
      ["vigil_space_summary", "heartgarden_space_summary"],
      ["vigil_list_items", "heartgarden_list_items"],
      ["vigil_search", "heartgarden_search"],
      ["vigil_graph", "heartgarden_graph"],
      ["vigil_get_item", "heartgarden_get_item"],
      ["vigil_get_entity", "heartgarden_get_entity"],
      ["vigil_item_links", "heartgarden_item_links"],
      ["vigil_traverse_links", "heartgarden_traverse_links"],
      ["vigil_related_items", "heartgarden_related_items"],
      ["vigil_title_mentions", "heartgarden_title_mentions"],
      ["vigil_lore_query", "heartgarden_lore_query"],
      ["vigil_semantic_search", "heartgarden_semantic_search"],
      ["vigil_index_item", "heartgarden_index_item"],
      ["vigil_reindex_space", "heartgarden_reindex_space"],
      ["vigil_patch_item", "heartgarden_patch_item"],
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
