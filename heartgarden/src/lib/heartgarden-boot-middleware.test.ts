import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const verifyMock = vi.fn();

vi.mock("@/src/lib/heartgarden-boot-edge", () => ({
  HEARTGARDEN_BOOT_COOKIE_NAME: "hg_boot",
  isHeartgardenBootApiAllowlisted: (pathname: string) =>
    pathname === "/api/heartgarden/boot" || pathname.startsWith("/api/heartgarden/boot/"),
  readBootGateEnvEdge: () => ({ gateEnabled: true, sessionSecret: "s".repeat(32) }),
  verifyBootSessionCookieEdge: (...args: unknown[]) => verifyMock(...args),
}));

describe("proxy boot gate", () => {
  beforeEach(() => {
    verifyMock.mockReset();
    verifyMock.mockResolvedValue({ tier: "access", exp: 9_999_999_999 });
  });

  it("allows GET /api/heartgarden/boot without cookie when gate is on", async () => {
    const { proxy } = await import("../../proxy");
    const req = new NextRequest(new URL("http://localhost/api/heartgarden/boot"));
    const res = await proxy(req);
    expect(res.status).toBe(200);
  });

  it("returns 403 for /api/bootstrap with no cookie when gate is on", async () => {
    const { proxy } = await import("../../proxy");
    const req = new NextRequest(new URL("http://localhost/api/bootstrap"));
    const res = await proxy(req);
    expect(res.status).toBe(403);
    const j = (await res.json()) as { ok: boolean; error: string };
    expect(j.ok).toBe(false);
  });

  it("returns 403 when cookie fails verification", async () => {
    verifyMock.mockResolvedValue(null);
    const { proxy } = await import("../../proxy");
    const req = new NextRequest(new URL("http://localhost/api/bootstrap"), {
      headers: { cookie: "hg_boot=invalid.token" },
    });
    const res = await proxy(req);
    expect(res.status).toBe(403);
  });

  it("allows /api/bootstrap when Authorization Bearer matches HEARTGARDEN_MCP_SERVICE_KEY", async () => {
    process.env.HEARTGARDEN_MCP_SERVICE_KEY = "mcp-service-test-secret";
    const { proxy } = await import("../../proxy");
    const req = new NextRequest(new URL("http://localhost/api/bootstrap"), {
      headers: { authorization: "Bearer mcp-service-test-secret" },
    });
    const res = await proxy(req);
    expect(res.status).toBe(200);
    delete process.env.HEARTGARDEN_MCP_SERVICE_KEY;
  });

  it("allows /api/mcp without cookie when gate is on (handler enforces Bearer)", async () => {
    const { proxy } = await import("../../proxy");
    const req = new NextRequest(new URL("http://localhost/api/mcp"));
    const res = await proxy(req);
    expect(res.status).toBe(200);
  });
});
