import { afterEach, describe, expect, it } from "vitest";

import {
  authorizationBearerMatchesMcpServiceKey,
  heartgardenMcpServiceKeyFromEnv,
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
