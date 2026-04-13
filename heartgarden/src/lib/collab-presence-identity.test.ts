import { describe, expect, it } from "vitest";

import { presenceEmojiForClientId, presenceHueForClientId } from "@/src/lib/collab-presence-identity";

describe("collab-presence-identity", () => {
  it("is deterministic per client id", () => {
    const id = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    expect(presenceEmojiForClientId(id)).toBe(presenceEmojiForClientId(id));
  });

  it("hue is in 0..359", () => {
    const h = presenceHueForClientId("bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee");
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(360);
  });
});
