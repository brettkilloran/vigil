import { describe, expect, it } from "vitest";

import {
  clampPresenceCamera,
  normalizePresenceDisplayName,
  presencePostBodySchema,
  safePresenceCameraFromUnknown,
  safePresenceSigilFromUnknown,
} from "@/src/lib/heartgarden-presence-body";

describe("heartgarden-presence-body", () => {
  it("parses valid POST body", () => {
    const p = presencePostBodySchema.safeParse({
      clientId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      camera: { x: 1, y: -2, zoom: 1.5 },
      pointer: { x: 10, y: 20 },
      displayName: "Avery North",
      sigil: "thread",
    });
    expect(p.success).toBe(true);
  });

  it("rejects zoom out of shell bounds", () => {
    const p = presencePostBodySchema.safeParse({
      clientId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      camera: { x: 0, y: 0, zoom: 99 },
    });
    expect(p.success).toBe(false);
  });

  it("clampPresenceCamera fixes bad numbers", () => {
    expect(
      clampPresenceCamera({ x: Number.NaN, y: 3, zoom: 0.05 })
    ).toMatchObject({
      x: 0,
      y: 3,
      zoom: 0.3,
    });
  });

  it("safePresenceCameraFromUnknown falls back for garbage", () => {
    expect(safePresenceCameraFromUnknown({ x: "nope" })).toEqual({
      x: 0,
      y: 0,
      zoom: 1,
    });
  });

  it("normalizes display names and rejects invalid names", () => {
    expect(normalizePresenceDisplayName("  Avery   North ")).toBe(
      "Avery North"
    );
    expect(normalizePresenceDisplayName("")).toBeNull();
    expect(normalizePresenceDisplayName("  ")).toBeNull();
    expect(normalizePresenceDisplayName("###")).toBeNull();
  });

  it("safePresenceSigilFromUnknown only accepts known variants", () => {
    expect(safePresenceSigilFromUnknown("thread")).toBe("thread");
    expect(safePresenceSigilFromUnknown("other")).toBeNull();
  });
});
