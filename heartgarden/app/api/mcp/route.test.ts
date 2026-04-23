import { afterEach, describe, expect, it, vi } from "vitest";

describe("/api/mcp", () => {
  afterEach(() => {
    vi.resetModules();
    delete process.env.HEARTGARDEN_MCP_SERVICE_KEY;
    delete process.env.HEARTGARDEN_MCP_ALLOW_QUERY_TOKEN;
  });

  it("returns 503 when HEARTGARDEN_MCP_SERVICE_KEY is unset", async () => {
    delete process.env.HEARTGARDEN_MCP_SERVICE_KEY;
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost/api/mcp", { method: "POST" }));
    expect(res.status).toBe(503);
  });

  it("returns 401 when no Bearer, query token, or header matches", async () => {
    process.env.HEARTGARDEN_MCP_SERVICE_KEY = "route-test-mcp-key";
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost/api/mcp", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("accepts POST with ?token= matching HEARTGARDEN_MCP_SERVICE_KEY", async () => {
    process.env.HEARTGARDEN_MCP_SERVICE_KEY = "route-test-mcp-key";
    process.env.HEARTGARDEN_MCP_ALLOW_QUERY_TOKEN = "1";
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/mcp?token=route-test-mcp-key", { method: "POST" }),
    );
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(503);
  });
});
