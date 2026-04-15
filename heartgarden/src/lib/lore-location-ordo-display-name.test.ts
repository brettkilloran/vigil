import { describe, expect, it } from "vitest";

import { ORDO_V7_EMPTY_NAME_SENTINEL, splitOrdoV7DisplayName } from "@/src/lib/lore-location-ordo-display-name";

describe("splitOrdoV7DisplayName", () => {
  it("returns empty sentinel when empty", () => {
    expect(splitOrdoV7DisplayName("")).toEqual({ line1: ORDO_V7_EMPTY_NAME_SENTINEL, line2: null });
  });

  it("single word is one line", () => {
    expect(splitOrdoV7DisplayName("Harbor")).toEqual({ line1: "HARBOR", line2: null });
  });

  it("two words split evenly", () => {
    expect(splitOrdoV7DisplayName("Old Harbor")).toEqual({
      line1: "OLD",
      line2: "HARBOR",
    });
  });

  it("five words: two on line 1, three on line 2 (balanced odd count)", () => {
    expect(splitOrdoV7DisplayName("Old Harbor Kiln No. 4")).toEqual({
      line1: "OLD HARBOR",
      line2: "KILN NO. 4",
    });
  });
});
