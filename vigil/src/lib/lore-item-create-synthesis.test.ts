import { describe, expect, it } from "vitest";

import {
  resolveLoreCardForCreate,
  synthesizeLoreCardContentJsonAndPlainText,
} from "./lore-item-create-synthesis";

describe("resolveLoreCardForCreate", () => {
  it("forces character to v11", () => {
    expect(resolveLoreCardForCreate({ kind: "character", loreVariant: "v1" })).toEqual({
      kind: "character",
      variant: "v11",
    });
  });
  it("defaults faction to v1", () => {
    expect(resolveLoreCardForCreate({ kind: "faction" })).toEqual({
      kind: "faction",
      variant: "v1",
    });
  });
});

describe("synthesizeLoreCardContentJsonAndPlainText", () => {
  it("includes loreCard and html format for faction", () => {
    const { contentJson, plainText } = synthesizeLoreCardContentJsonAndPlainText({
      loreCard: { kind: "faction", variant: "v1" },
    });
    expect(contentJson.format).toBe("html");
    expect(typeof contentJson.html).toBe("string");
    expect((contentJson.hgArch as { loreCard?: { kind: string } }).loreCard?.kind).toBe("faction");
    expect(plainText.length).toBeGreaterThan(0);
  });
});
