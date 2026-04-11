import { afterEach, describe, expect, it } from "vitest";

import {
  authorizationBearerMatchesMcpServiceKey,
  heartgardenMcpServiceKeyFromEnv,
  mcpRequestAuthorizedByServiceKey,
  timingSafeEqualUtf8,
} from "./heartgarden-mcp-service-key";

describe("heartgarden-mcp-service-key", () => {
  afterEach(() => {
    delete process.env.HEARTGARDEN_MCP_SERVICE_KEY;
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
    expect(authorizationBearerMatchesMcpServiceKey("Bearer secret-token-one")).toBe(true);
    expect(authorizationBearerMatchesMcpServiceKey("bearer secret-token-one")).toBe(true);
    expect(authorizationBearerMatchesMcpServiceKey("Bearer wrong")).toBe(false);
  });
});

describe("mcpRequestAuthorizedByServiceKey", () => {
  afterEach(() => {
    delete process.env.HEARTGARDEN_MCP_SERVICE_KEY;
  });

  it("accepts matching token query param", () => {
    process.env.HEARTGARDEN_MCP_SERVICE_KEY = "q-secret";
    const req = new Request("https://example.com/api/mcp?token=q-secret");
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
