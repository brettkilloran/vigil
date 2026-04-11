import { afterEach, describe, expect, it } from "vitest";

import { resolveHeartgardenMcpBaseUrl } from "./heartgarden-mcp-server";

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
