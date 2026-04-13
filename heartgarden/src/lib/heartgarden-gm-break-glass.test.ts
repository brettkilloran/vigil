import { afterEach, describe, expect, it } from "vitest";

import { isHeartgardenGmPlayerSpaceBreakGlassEnabled } from "@/src/lib/heartgarden-gm-break-glass";

describe("isHeartgardenGmPlayerSpaceBreakGlassEnabled", () => {
  const prev = process.env.HEARTGARDEN_GM_ALLOW_PLAYER_SPACE;

  afterEach(() => {
    if (prev === undefined) delete process.env.HEARTGARDEN_GM_ALLOW_PLAYER_SPACE;
    else process.env.HEARTGARDEN_GM_ALLOW_PLAYER_SPACE = prev;
  });

  it("is false by default", () => {
    delete process.env.HEARTGARDEN_GM_ALLOW_PLAYER_SPACE;
    expect(isHeartgardenGmPlayerSpaceBreakGlassEnabled()).toBe(false);
  });

  it("is true when set to 1", () => {
    process.env.HEARTGARDEN_GM_ALLOW_PLAYER_SPACE = "1";
    expect(isHeartgardenGmPlayerSpaceBreakGlassEnabled()).toBe(true);
  });
});
