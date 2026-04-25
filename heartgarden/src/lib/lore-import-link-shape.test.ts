import { describe, expect, it } from "vitest";

import {
  CANONICAL_IMPORT_LINK_TYPES,
  coerceImportLinkType,
} from "@/src/lib/lore-import-link-shape";

const DOES_NOT_FIT_RE = /does not fit/;
const RESERVED_FOR_CANVAS_ROPES_RE = /reserved for canvas ropes/;
const UNKNOWN_LINK_TYPE_RE = /Unknown link type/;

describe("coerceImportLinkType", () => {
  it("allows bond between two characters (either canonical form)", () => {
    for (const a of ["character", "npc"]) {
      for (const b of ["character", "npc"]) {
        const r = coerceImportLinkType(a, b, "bond");
        expect(r.coerced).toBe(false);
        expect(r.linkType).toBe("bond");
      }
    }
  });

  it("coerces bond between non-character endpoints to history", () => {
    const r = coerceImportLinkType("faction", "faction", "bond");
    expect(r.coerced).toBe(true);
    expect(r.linkType).toBe("history");
    expect(r.reason).toMatch(DOES_NOT_FIT_RE);
  });

  it("allows affiliation between character/faction either direction", () => {
    expect(coerceImportLinkType("npc", "faction", "affiliation").linkType).toBe(
      "affiliation"
    );
    expect(
      coerceImportLinkType("faction", "character", "affiliation").linkType
    ).toBe("affiliation");
    expect(
      coerceImportLinkType("faction", "faction", "affiliation").linkType
    ).toBe("affiliation");
  });

  it("coerces affiliation between two lore notes to history", () => {
    const r = coerceImportLinkType("lore", "lore", "affiliation");
    expect(r.coerced).toBe(true);
    expect(r.linkType).toBe("history");
  });

  it("allows contract between character/faction and character/character", () => {
    expect(
      coerceImportLinkType("character", "faction", "contract").linkType
    ).toBe("contract");
    expect(
      coerceImportLinkType("character", "character", "contract").linkType
    ).toBe("contract");
    expect(
      coerceImportLinkType("faction", "faction", "contract").linkType
    ).toBe("contract");
  });

  it("accepts conflict between any pair", () => {
    expect(coerceImportLinkType("lore", "item", "conflict").linkType).toBe(
      "conflict"
    );
    expect(
      coerceImportLinkType("character", "location", "conflict").linkType
    ).toBe("conflict");
  });

  it("accepts history as catch-all for any pair", () => {
    expect(coerceImportLinkType("lore", "quest", "history").linkType).toBe(
      "history"
    );
    expect(coerceImportLinkType("location", "other", "history").linkType).toBe(
      "history"
    );
  });

  it("forbids pin on imports and coerces to history", () => {
    const r = coerceImportLinkType("character", "character", "pin");
    expect(r.coerced).toBe(true);
    expect(r.linkType).toBe("history");
    expect(r.reason).toMatch(RESERVED_FOR_CANVAS_ROPES_RE);
  });

  it("falls back through legacy aliases before validating", () => {
    // "ally" is an alias for "bond" — stays as bond for character pairs.
    expect(
      coerceImportLinkType("character", "character", "ally").linkType
    ).toBe("bond");
    // "enemy" is an alias for "conflict" — accepted anywhere.
    expect(coerceImportLinkType("faction", "lore", "enemy").linkType).toBe(
      "conflict"
    );
  });

  it("coerces unknown types to history", () => {
    const r = coerceImportLinkType("character", "character", "totally_made_up");
    expect(r.coerced).toBe(true);
    expect(r.linkType).toBe("history");
    expect(r.reason).toMatch(UNKNOWN_LINK_TYPE_RE);
  });

  it("every canonical import link type is exported", () => {
    expect(CANONICAL_IMPORT_LINK_TYPES).toEqual([
      "bond",
      "affiliation",
      "contract",
      "conflict",
      "history",
    ]);
  });
});
