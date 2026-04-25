import { describe, expect, it } from "vitest";

import {
  defaultItemDimensions,
  jitterHgRotationDeg,
  synthesizeContentJsonForCreateItem,
} from "./item-create-defaults";

describe("defaultItemDimensions", () => {
  it("uses lore shell size for character", () => {
    expect(defaultItemDimensions("note", "character")).toEqual({
      height: 280,
      width: 340,
    });
  });
  it("uses note size without character entity", () => {
    expect(defaultItemDimensions("note", null)).toEqual({
      height: 270,
      width: 340,
    });
  });
  it("uses checklist size", () => {
    expect(defaultItemDimensions("checklist", null)).toEqual({
      height: 188,
      width: 340,
    });
  });
  it("falls back for other types", () => {
    expect(defaultItemDimensions("folder", null)).toEqual({
      height: 200,
      width: 280,
    });
  });
});

describe("jitterHgRotationDeg", () => {
  it("stays within ±2 degrees", () => {
    for (let i = 0; i < 50; i++) {
      const v = jitterHgRotationDeg();
      expect(v).toBeGreaterThanOrEqual(-2);
      expect(v).toBeLessThanOrEqual(2);
    }
  });
});

describe("synthesizeContentJsonForCreateItem", () => {
  it("returns hgDoc checklist seed for checklist", () => {
    const j = synthesizeContentJsonForCreateItem({
      contentText: "",
      itemType: "checklist",
      theme: "default",
    });
    expect(j?.format).toBe("hgDoc");
    expect((j?.hgArch as { theme?: string })?.theme).toBe("task");
  });
  it("returns html note body for note", () => {
    const j = synthesizeContentJsonForCreateItem({
      contentText: "Hello",
      itemType: "note",
      theme: "code",
    });
    expect(j?.format).toBe("html");
    expect((j?.hgArch as { theme?: string })?.theme).toBe("code");
  });
});
