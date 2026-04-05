import { afterEach, describe, expect, it } from "vitest";

import type { HeartgardenApiBootContext } from "@/src/lib/heartgarden-api-boot-context";
import {
  applySearchTierPolicy,
  applySuggestTierPolicy,
} from "@/src/lib/heartgarden-search-tier-policy";

/** Valid v4-style UUID for `parseSpaceIdParam`. */
const PLAYER_UUID = "11111111-1111-4111-8111-111111111111";

describe("applySearchTierPolicy", () => {
  const prevPlayerSpace = process.env.HEARTGARDEN_PLAYER_SPACE_ID;
  const prevBreakGlass = process.env.HEARTGARDEN_GM_ALLOW_PLAYER_SPACE;

  afterEach(() => {
    if (prevPlayerSpace === undefined) delete process.env.HEARTGARDEN_PLAYER_SPACE_ID;
    else process.env.HEARTGARDEN_PLAYER_SPACE_ID = prevPlayerSpace;
    if (prevBreakGlass === undefined) delete process.env.HEARTGARDEN_GM_ALLOW_PLAYER_SPACE;
    else process.env.HEARTGARDEN_GM_ALLOW_PLAYER_SPACE = prevBreakGlass;
  });

  it("forces visitor space and fts for hybrid", () => {
    const ctx: HeartgardenApiBootContext = { role: "visitor", playerSpaceId: PLAYER_UUID };
    const r = applySearchTierPolicy(ctx, {}, "hybrid");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.filters.spaceId).toBe(PLAYER_UUID);
      expect(r.mode).toBe("fts");
    }
  });

  it("rejects visitor with wrong spaceId", () => {
    const ctx: HeartgardenApiBootContext = { role: "visitor", playerSpaceId: PLAYER_UUID };
    const r = applySearchTierPolicy(ctx, { spaceId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" }, "fts");
    expect(r.ok).toBe(false);
  });

  it("adds excludeSpaceId for GM global search when player space is configured", () => {
    process.env.HEARTGARDEN_PLAYER_SPACE_ID = PLAYER_UUID;
    const ctx: HeartgardenApiBootContext = { role: "gm" };
    const r = applySearchTierPolicy(ctx, {}, "hybrid");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.filters.excludeSpaceId).toBe(PLAYER_UUID);
      expect(r.mode).toBe("hybrid");
    }
  });

  it("does not downgrade GM hybrid when player space is unset", () => {
    delete process.env.HEARTGARDEN_PLAYER_SPACE_ID;
    const ctx: HeartgardenApiBootContext = { role: "gm" };
    const r = applySearchTierPolicy(ctx, {}, "hybrid");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.filters.excludeSpaceId).toBeUndefined();
      expect(r.mode).toBe("hybrid");
    }
  });

  it("skips global excludeSpaceId when GM break-glass is enabled", () => {
    process.env.HEARTGARDEN_PLAYER_SPACE_ID = PLAYER_UUID;
    process.env.HEARTGARDEN_GM_ALLOW_PLAYER_SPACE = "1";
    const ctx: HeartgardenApiBootContext = { role: "gm" };
    const r = applySearchTierPolicy(ctx, {}, "hybrid");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.filters.excludeSpaceId).toBeUndefined();
      expect(r.mode).toBe("hybrid");
    }
    const s = applySuggestTierPolicy(ctx, {});
    expect(s.ok).toBe(true);
    if (s.ok) expect(s.filters.excludeSpaceId).toBeUndefined();
  });
});
