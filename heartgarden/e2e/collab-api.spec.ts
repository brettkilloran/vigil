import { test, expect } from "@playwright/test";

/**
 * Under `PLAYWRIGHT_E2E=1`, delta and presence routes return empty stubs without Postgres.
 * @see playwright.config.ts
 */
test.describe("collaboration API stubs (e2e server)", () => {
  test("GET /api/spaces/[id]/changes returns ok + arrays", async ({ request }) => {
    const res = await request.get(
      "/api/spaces/00000000-0000-4000-8000-000000000001/changes?since=1970-01-01T00:00:00.000Z&includeItemIds=1",
    );
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as {
      ok?: boolean;
      items?: unknown[];
      spaces?: unknown[];
      itemIds?: unknown[];
      cursor?: string;
    };
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.items)).toBe(true);
    expect(Array.isArray(body.spaces)).toBe(true);
    expect(Array.isArray(body.itemIds)).toBe(true);
    expect(typeof body.cursor).toBe("string");
  });

  test("GET /api/spaces/[id]/changes omits itemIds without includeItemIds=1", async ({ request }) => {
    const res = await request.get(
      "/api/spaces/00000000-0000-4000-8000-000000000001/changes?since=1970-01-01T00:00:00.000Z",
    );
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { ok?: boolean; itemIds?: unknown[]; spaces?: unknown[] };
    expect(body.ok).toBe(true);
    expect(body.itemIds).toBeUndefined();
    expect(Array.isArray(body.spaces)).toBe(true);
  });

  test("GET /api/spaces/[id]/presence returns ok", async ({ request }) => {
    const res = await request.get(
      "/api/spaces/00000000-0000-4000-8000-000000000001/presence",
    );
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { ok?: boolean; peers?: unknown[] };
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.peers)).toBe(true);
  });

  test("DELETE /api/spaces/[id]/presence returns ok with clientId", async ({ request }) => {
    const res = await request.delete(
      "/api/spaces/00000000-0000-4000-8000-000000000001/presence?clientId=11111111-1111-4111-8111-111111111111",
    );
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { ok?: boolean };
    expect(body.ok).toBe(true);
  });
});
