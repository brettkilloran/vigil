import { afterEach, describe, expect, it, vi } from "vitest";

import type { HeartgardenApiBootContext } from "@/src/lib/heartgarden-api-boot-context";
// biome-ignore lint/performance/noNamespaceImport: vi.spyOn(target, name) needs the module namespace object as its first argument
import * as heartgardenApiBootContext from "@/src/lib/heartgarden-api-boot-context";
import {
  applySearchTierPolicy,
  applySuggestTierPolicy,
  finalizeHeartgardenSearchFiltersForDb,
} from "@/src/lib/heartgarden-search-tier-policy";
import type { VigilDb } from "@/src/lib/spaces";

/** Valid v4-style UUID for `parseSpaceIdParam`. */
const PLAYER_UUID = "11111111-1111-4111-8111-111111111111";

describe("applySearchTierPolicy", () => {
  const prevBreakGlass = process.env.HEARTGARDEN_GM_ALLOW_PLAYER_SPACE;

  afterEach(() => {
    vi.restoreAllMocks();
    if (prevBreakGlass === undefined) {
      delete process.env.HEARTGARDEN_GM_ALLOW_PLAYER_SPACE;
    } else {
      process.env.HEARTGARDEN_GM_ALLOW_PLAYER_SPACE = prevBreakGlass;
    }
  });

  it("downgrades hybrid to fts for player without mutating space filters", () => {
    const ctx: HeartgardenApiBootContext = {
      playerSpaceId: PLAYER_UUID,
      role: "player",
    };
    const r = applySearchTierPolicy(ctx, {}, "hybrid");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.filters.spaceId).toBeUndefined();
      expect(r.mode).toBe("fts");
    }
  });

  it("finalize rejects player when spaceId is outside their subtree", async () => {
    vi.spyOn(
      heartgardenApiBootContext,
      "playerMayAccessSpaceIdAsync"
    ).mockResolvedValue(false);
    const db = {} as unknown as VigilDb;
    const ctx: HeartgardenApiBootContext = {
      playerSpaceId: PLAYER_UUID,
      role: "player",
    };
    const out = await finalizeHeartgardenSearchFiltersForDb(db, ctx, {
      spaceId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    });
    expect(out).toBeNull();
  });

  it("finalize scopes player search to full subtree when spaceId omitted", async () => {
    const child = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const slim = [
      { id: PLAYER_UUID, parentSpaceId: null as string | null },
      { id: child, parentSpaceId: PLAYER_UUID },
    ];
    const db = {
      select: () => ({ from: () => Promise.resolve(slim) }),
    } as unknown as VigilDb;
    const ctx: HeartgardenApiBootContext = {
      playerSpaceId: PLAYER_UUID,
      role: "player",
    };
    const out = await finalizeHeartgardenSearchFiltersForDb(db, ctx, {});
    expect(out?.spaceId).toBeUndefined();
    expect(out?.spaceIds?.slice().sort()).toEqual([PLAYER_UUID, child].sort());
  });

  it("finalize expands GM excludeSpaceId to full subtree", async () => {
    const child = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const slim = [
      { id: PLAYER_UUID, parentSpaceId: null as string | null },
      { id: child, parentSpaceId: PLAYER_UUID },
    ];
    const db = {
      select: () => ({ from: () => Promise.resolve(slim) }),
    } as unknown as VigilDb;
    const ctx: HeartgardenApiBootContext = { role: "gm" };
    const out = await finalizeHeartgardenSearchFiltersForDb(db, ctx, {
      excludeSpaceId: PLAYER_UUID,
    });
    expect(out?.excludeSpaceId).toBeUndefined();
    expect(out?.excludeSpaceIds?.slice().sort()).toEqual(
      [PLAYER_UUID, child].sort()
    );
  });

  it("keeps GM global filters unchanged in apply tier policy", () => {
    const ctx: HeartgardenApiBootContext = { role: "gm" };
    const r = applySearchTierPolicy(ctx, {}, "hybrid");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.filters.excludeSpaceId).toBeUndefined();
      expect(r.mode).toBe("hybrid");
    }
  });

  it("does not downgrade GM hybrid mode", () => {
    const ctx: HeartgardenApiBootContext = { role: "gm" };
    const r = applySearchTierPolicy(ctx, {}, "hybrid");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.filters.excludeSpaceId).toBeUndefined();
      expect(r.mode).toBe("hybrid");
    }
  });

  it("suggest policy stays pass-through for GM (break-glass unchanged)", () => {
    process.env.HEARTGARDEN_GM_ALLOW_PLAYER_SPACE = "1";
    const ctx: HeartgardenApiBootContext = { role: "gm" };
    const s = applySuggestTierPolicy(ctx, {});
    expect(s.ok).toBe(true);
    if (s.ok) {
      expect(s.filters.excludeSpaceId).toBeUndefined();
    }
  });
});
