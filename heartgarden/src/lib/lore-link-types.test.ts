import { describe, expect, it } from "vitest";

import type { CanvasContentEntity } from "@/src/components/foundation/architectural-types";
import {
  groupedOrderedLinkOptionsForEndpoints,
  menuLabelForLinkType,
  orderedLoreLinkTypeOptionsForEndpoints,
} from "@/src/lib/lore-link-types";

function contentEntity(
  id: string,
  loreKind: "character" | "faction" | "location"
): CanvasContentEntity {
  const loreCard =
    loreKind === "character"
      ? { kind: "character" as const, variant: "v11" as const }
      : loreKind === "location"
        ? { kind: "location" as const, variant: "v2" as const }
        : { kind: "faction" as const, variant: "v4" as const };
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
  it("menuLabelForLinkType normalizes legacy values to canonical labels", () => {
    expect(menuLabelForLinkType("faction")).toBe("Affiliation");
    expect(menuLabelForLinkType("enemy")).toBe("Conflict");
  });

  it("orders bond above history for two character cards", () => {
    const a = contentEntity("a", "character");
    const b = contentEntity("b", "character");
    const ordered = orderedLoreLinkTypeOptionsForEndpoints(a, b);
    const bondIdx = ordered.findIndex((o) => o.value === "bond");
    const historyIdx = ordered.findIndex((o) => o.value === "history");
    expect(bondIdx).toBeGreaterThanOrEqual(0);
    expect(historyIdx).toBeGreaterThanOrEqual(0);
    expect(bondIdx).toBeLessThan(historyIdx);
  });

  it("orders affiliation above contract for character↔faction links", () => {
    const a = contentEntity("a", "character");
    const b = contentEntity("b", "faction");
    const ordered = orderedLoreLinkTypeOptionsForEndpoints(a, b);
    const affIdx = ordered.findIndex((o) => o.value === "affiliation");
    const contractIdx = ordered.findIndex((o) => o.value === "contract");
    expect(affIdx).toBeGreaterThanOrEqual(0);
    expect(contractIdx).toBeGreaterThanOrEqual(0);
    expect(affIdx).toBeLessThan(contractIdx);
  });

  it("orders history above contract for character↔location links", () => {
    const a = contentEntity("a", "location");
    const b = contentEntity("b", "character");
    const ordered = orderedLoreLinkTypeOptionsForEndpoints(a, b);
    const historyIdx = ordered.findIndex((o) => o.value === "history");
    const contractIdx = ordered.findIndex((o) => o.value === "contract");
    expect(historyIdx).toBeGreaterThanOrEqual(0);
    expect(contractIdx).toBeGreaterThanOrEqual(0);
    expect(historyIdx).toBeLessThan(contractIdx);
  });

  it("groupedOrderedLinkOptionsForEndpoints returns two groups with canvas first", () => {
    const grouped = groupedOrderedLinkOptionsForEndpoints(undefined, undefined);
    expect(grouped.map((g) => g.group)).toEqual(["canvas", "relationship"]);
  });
});
