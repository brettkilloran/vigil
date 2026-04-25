import { describe, expect, it } from "vitest";

import {
  playersMayCreateItemType,
  playersPatchBodyViolatesPolicy,
} from "@/src/lib/player-item-policy";

describe("player-item-policy", () => {
  it("allows only note, sticky, checklist for create", () => {
    expect(playersMayCreateItemType("note")).toBe(true);
    expect(playersMayCreateItemType("image")).toBe(false);
    expect(playersMayCreateItemType("folder")).toBe(true);
    expect(playersMayCreateItemType("webclip")).toBe(false);
  });

  it("rejects image fields and GM entityMeta for Players patch", () => {
    expect(playersPatchBodyViolatesPolicy({ imageUrl: "https://x" })).toBe(
      true
    );
    expect(playersPatchBodyViolatesPolicy({ imageMeta: {} })).toBe(true);
    expect(
      playersPatchBodyViolatesPolicy({ entityMeta: { loreReviewTags: [] } })
    ).toBe(true);
    expect(
      playersPatchBodyViolatesPolicy({
        entityMetaMerge: { loreHistorical: true },
      })
    ).toBe(true);
    expect(playersPatchBodyViolatesPolicy({ itemType: "image" })).toBe(true);
    expect(playersPatchBodyViolatesPolicy({ itemType: "note" })).toBe(false);
  });
});
