import { describe, expect, it } from "vitest";

import { buildFactionArchive091BodyHtml, factionArchiveRailTextsFromObjectId } from "./lore-faction-archive-html";
import {
  resolveLoreCardForCreate,
  synthesizeLoreCardContentJsonAndPlainText,
} from "./lore-item-create-synthesis";
import {
  shouldRenderLoreCharacterCredentialCanvasNode,
  shouldRenderLoreFactionArchive091CanvasNode,
} from "./lore-node-seed-html";

describe("resolveLoreCardForCreate", () => {
  it("forces character to v11", () => {
    expect(resolveLoreCardForCreate({ kind: "character", loreVariant: "v1" })).toEqual({
      kind: "character",
      variant: "v11",
    });
  });
  it("defaults faction to v4 (Archive-091)", () => {
    expect(resolveLoreCardForCreate({ kind: "faction" })).toEqual({
      kind: "faction",
      variant: "v4",
    });
  });
});

describe("synthesizeLoreCardContentJsonAndPlainText", () => {
  it("includes loreCard and html format for faction", () => {
    const { contentJson, plainText } = synthesizeLoreCardContentJsonAndPlainText({
      loreCard: { kind: "faction", variant: "v4" },
    });
    expect(contentJson.format).toBe("html");
    expect(typeof contentJson.html).toBe("string");
    expect((contentJson.hgArch as { loreCard?: { kind: string } }).loreCard?.kind).toBe("faction");
    expect(plainText.length).toBeGreaterThan(0);
  });
});

describe("lore canvas shell routing", () => {
  it("faction Archive-091 is not misclassified as character v11 (shared charSkShellV11 letterhead)", () => {
    const { upper, lower } = factionArchiveRailTextsFromObjectId("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    const html = buildFactionArchive091BodyHtml({
      orgPrimaryInnerHtml: "",
      orgAccentInnerHtml: "",
      recordInnerHtml: "<p><br></p>",
      railUpper: upper,
      railLower: lower,
    });
    const entity = {
      kind: "content" as const,
      bodyHtml: html,
      loreCard: { kind: "faction" as const, variant: "v4" as const },
    };
    expect(shouldRenderLoreFactionArchive091CanvasNode(entity)).toBe(true);
    expect(shouldRenderLoreCharacterCredentialCanvasNode(entity)).toBe(false);
  });
});
