import { describe, expect, it } from "vitest";

import { LINK_SEMANTICS_STRUCTURED_MIRROR } from "@/src/lib/item-link-meta";
import { validateStructuredMirrorItemLink } from "@/src/lib/item-links-structured-validation";

describe("validateStructuredMirrorItemLink", () => {
  it("allows association meta", () => {
    const r = validateStructuredMirrorItemLink(
      { linkSemantics: "association" },
      { id: "a", entityType: "character" },
      { id: "b", entityType: "faction" },
    );
    expect(r.ok).toBe(true);
  });

  it("requires bindingSlotId for structured_mirror", () => {
    const r = validateStructuredMirrorItemLink(
      { linkSemantics: LINK_SEMANTICS_STRUCTURED_MIRROR },
      { id: "a", entityType: "character" },
      { id: "b", entityType: "faction" },
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status).toBe(400);
  });

  it("accepts faction roster slot for faction+character", () => {
    const r = validateStructuredMirrorItemLink(
      {
        linkSemantics: LINK_SEMANTICS_STRUCTURED_MIRROR,
        bindingSlotId: "faction.factionRoster",
      },
      { id: "f", entityType: "faction" },
      { id: "c", entityType: "character" },
    );
    expect(r.ok).toBe(true);
  });

  it("rejects wrong bound type for slot", () => {
    const r = validateStructuredMirrorItemLink(
      {
        linkSemantics: LINK_SEMANTICS_STRUCTURED_MIRROR,
        bindingSlotId: "faction.factionRoster",
      },
      { id: "f", entityType: "faction" },
      { id: "x", entityType: "location" },
    );
    expect(r.ok).toBe(false);
  });
});
