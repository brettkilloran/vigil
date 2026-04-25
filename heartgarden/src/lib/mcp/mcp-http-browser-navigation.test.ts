import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { isLikelyBrowserDocumentNavigation } from "./mcp-http-browser-navigation";

describe("isLikelyBrowserDocumentNavigation", () => {
  it("is true for typical browser address-bar navigation", () => {
    const r = new NextRequest("http://localhost/api/mcp", {
      headers: {
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
      },
    });
    expect(isLikelyBrowserDocumentNavigation(r)).toBe(true);
  });

  it("is false without Sec-Fetch (curl, server-side fetch, MCP clients)", () => {
    const r = new NextRequest("http://localhost/api/mcp", {
      method: "GET",
    });
    expect(isLikelyBrowserDocumentNavigation(r)).toBe(false);
  });

  it("is false for non-GET", () => {
    const r = new NextRequest("http://localhost/api/mcp", {
      headers: {
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
      },
      method: "POST",
    });
    expect(isLikelyBrowserDocumentNavigation(r)).toBe(false);
  });
});
