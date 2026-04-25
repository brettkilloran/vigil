import { afterEach, describe, expect, it } from "vitest";

import {
  authorizationBearerMatchesMcpServiceKey,
  heartgardenMcpServiceKeyFromEnv,
  mcpRequestAuthorizedByServiceKey,
  mcpTokenFromRequestUrlString,
  timingSafeEqualUtf8,
} from "./heartgarden-mcp-service-key";

describe("heartgarden-mcp-service-key", () => {
  afterEach(() => {
    delete process.env.HEARTGARDEN_MCP_SERVICE_KEY;
    delete process.env.HEARTGARDEN_MCP_ALLOW_QUERY_TOKEN;
  });

  it("timingSafeEqualUtf8 matches equal strings", () => {
    expect(timingSafeEqualUtf8("abc", "abc")).toBe(true);
    expect(timingSafeEqualUtf8("abc", "abd")).toBe(false);
  });

  it("authorizationBearerMatchesMcpServiceKey is false when env unset", () => {
    expect(authorizationBearerMatchesMcpServiceKey("Bearer x")).toBe(false);
    expect(heartgardenMcpServiceKeyFromEnv()).toBe("");
  });

  it("authorizationBearerMatchesMcpServiceKey accepts valid Bearer token", () => {
    process.env.HEARTGARDEN_MCP_SERVICE_KEY = "secret-token-one";
    expect(
      authorizationBearerMatchesMcpServiceKey("Bearer secret-token-one")
    ).toBe(true);
    expect(
      authorizationBearerMatchesMcpServiceKey("bearer secret-token-one")
    ).toBe(true);
    expect(authorizationBearerMatchesMcpServiceKey("Bearer wrong")).toBe(false);
  });
});

describe("mcpTokenFromRequestUrlString", () => {
  it("parses path-only Next-style URL", () => {
    expect(mcpTokenFromRequestUrlString("/api/mcp?token=abc&x=1")).toBe("abc");
    expect(mcpTokenFromRequestUrlString("/api/mcp")).toBe(null);
  });

  it("parses absolute URL", () => {
    expect(mcpTokenFromRequestUrlString("https://x.com/api/mcp?token=z")).toBe(
      "z"
    );
  });
});

describe("mcpRequestAuthorizedByServiceKey", () => {
  afterEach(() => {
    delete process.env.HEARTGARDEN_MCP_SERVICE_KEY;
    delete process.env.HEARTGARDEN_MCP_ALLOW_QUERY_TOKEN;
  });

  it("rejects matching token query param when query token auth is disabled", () => {
    process.env.HEARTGARDEN_MCP_SERVICE_KEY = "q-secret";
    const req = new Request("https://example.com/api/mcp?token=q-secret");
    expect(mcpRequestAuthorizedByServiceKey(req)).toBe(false);
  });

  it("accepts token query param when query token auth is explicitly enabled", () => {
    process.env.HEARTGARDEN_MCP_SERVICE_KEY = "q-secret";
    process.env.HEARTGARDEN_MCP_ALLOW_QUERY_TOKEN = "1";
    const req = new Request("https://example.com/api/mcp?token=q-secret");
    expect(mcpRequestAuthorizedByServiceKey(req)).toBe(true);
  });

  it("accepts path-only request.url with token when query token auth is enabled (Next.js shape)", () => {
    process.env.HEARTGARDEN_MCP_SERVICE_KEY = "path-only-secret";
    process.env.HEARTGARDEN_MCP_ALLOW_QUERY_TOKEN = "1";
    const req = {
      url: "/api/mcp?token=path-only-secret",
      headers: new Headers(),
    } as unknown as Request;
    expect(mcpRequestAuthorizedByServiceKey(req)).toBe(true);
  });

  it("accepts X-Heartgarden-Mcp-Token header", () => {
    process.env.HEARTGARDEN_MCP_SERVICE_KEY = "h-secret";
    const req = new Request("https://example.com/api/mcp", {
      headers: { "X-Heartgarden-Mcp-Token": "h-secret" },
    });
    expect(mcpRequestAuthorizedByServiceKey(req)).toBe(true);
  });
});
