import { afterEach, describe, expect, it, vi } from "vitest";

describe("/api/mcp", () => {
  afterEach(() => {
    vi.resetModules();
    delete process.env.HEARTGARDEN_MCP_SERVICE_KEY;
  });

  it("returns 503 when HEARTGARDEN_MCP_SERVICE_KEY is unset", async () => {
    delete process.env.HEARTGARDEN_MCP_SERVICE_KEY;
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost/api/mcp", { method: "POST" }));
    expect(res.status).toBe(503);
  });

  it("returns 401 when Authorization is missing", async () => {
    process.env.HEARTGARDEN_MCP_SERVICE_KEY = "route-test-mcp-key";
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost/api/mcp", { method: "POST" }));
    expect(res.status).toBe(401);
  });
});
