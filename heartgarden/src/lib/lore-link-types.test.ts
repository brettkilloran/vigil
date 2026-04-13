import { describe, expect, it } from "vitest";

import type { CanvasContentEntity } from "@/src/components/foundation/architectural-types";
import {
  groupedOrderedLinkOptionsForEndpoints,
  menuLabelForLinkType,
  orderedLoreLinkTypeOptionsForEndpoints,
} from "@/src/lib/lore-link-types";

function contentEntity(id: string, loreKind: "character" | "faction" | "location"): CanvasContentEntity {
  const loreCard =
    loreKind === "character"
      ? { kind: "character" as const, variant: "v11" as const }
      : loreKind === "location"
        ? { kind: "location" as const, variant: "v2" as const }
        : { kind: "faction" as const, variant: "v1" as const };
  return {
    id,
    kind: "content",
    theme: "default",
    title: id,
    rotation: 0,
    tapeRotation: 0,
    slots: {},
    bodyHtml: "",
    loreCard,
  };
}

describe("lore-link-types", () => {
  it("menuLabelForLinkType uses friendly labels for legacy role tags", () => {
    expect(menuLabelForLinkType("faction")).toContain("Organization");
    expect(menuLabelForLinkType("npc")).toContain("Character");
  });

  it("orders ally above redundant location tag for two location cards", () => {
    const a = contentEntity("a", "location");
    const b = contentEntity("b", "location");
    const ordered = orderedLoreLinkTypeOptionsForEndpoints(a, b);
    const allyIdx = ordered.findIndex((o) => o.value === "ally");
    const locIdx = ordered.findIndex((o) => o.value === "location");
    expect(allyIdx).toBeGreaterThanOrEqual(0);
    expect(locIdx).toBeGreaterThanOrEqual(0);
    expect(allyIdx).toBeLessThan(locIdx);
  });

  it("groupedOrderedLinkOptionsForEndpoints returns three groups with canvas first", () => {
    const grouped = groupedOrderedLinkOptionsForEndpoints(undefined, undefined);
    expect(grouped.map((g) => g.group)).toEqual(["canvas", "relationship", "story_tag"]);
  });
});
