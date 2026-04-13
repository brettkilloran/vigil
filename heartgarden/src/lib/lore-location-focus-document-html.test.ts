/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";

import {
  focusDocumentHtmlToLocationBody,
  locationBodyToFocusDocumentHtml,
  plainPlaceNameFromLocationBodyHtml,
} from "@/src/lib/lore-location-focus-document-html";
import { getLoreNodeSeedBodyHtml, shouldRenderLoreLocationCanvasNode } from "@/src/lib/lore-node-seed-html";

describe("plainPlaceNameFromLocationBodyHtml", () => {
  it("reads modern name field", () => {
    const body = `<div data-hg-canvas-role="lore-location">
<div data-hg-lore-location-field="name">Harbor Kiln</div>
</div>`;
    expect(plainPlaceNameFromLocationBodyHtml(body)).toBe("Harbor Kiln");
  });

  it("reads legacy locName", () => {
    const body = `<div class="x_locHeader_y"><div class="x_locName_y">Old Pier</div></div>`;
    expect(plainPlaceNameFromLocationBodyHtml(body)).toBe("Old Pier");
  });

  it("returns empty when missing", () => {
    expect(plainPlaceNameFromLocationBodyHtml("<div></div>")).toBe("");
  });
});

describe("location focus projection round-trip", () => {
  it("round-trips modern v2 seed: notes and fields merge back; chrome preserved", () => {
    const canonical = getLoreNodeSeedBodyHtml("location", "v2");
    const focus = locationBodyToFocusDocumentHtml(canonical);
    expect(focus).toContain("data-hg-location-focus-doc");
    expect(focus).toContain("data-hg-lore-location-focus-notes");

    const wrapped = `<div id="__hg_rt">${focus}</div>`;
    const doc = new DOMParser().parseFromString(wrapped, "text/html");
    const host = doc.getElementById("__hg_rt");
    expect(host).not.toBeNull();
    const notesEl = host!.querySelector<HTMLElement>('[data-hg-lore-location-focus-notes="true"]');
    expect(notesEl).not.toBeNull();
    notesEl!.innerHTML = "<p>Smoke note</p>";
    const editedFocus = host!.innerHTML;
    const merged = focusDocumentHtmlToLocationBody(editedFocus, canonical);
    expect(merged).toContain('data-hg-canvas-role="lore-location"');
    expect(merged).toContain("Smoke note");
    expect(merged).toContain('data-hg-lore-location-field="name"');
  });

  it("round-trips location v3 seed: strip attribute survives merge", () => {
    const canonical = getLoreNodeSeedBodyHtml("location", "v3", { locationStripSeed: "fixture-seed" });
    expect(canonical).toMatch(/data-loc-strip="\d"/);
    const focus = locationBodyToFocusDocumentHtml(canonical);
    const merged = focusDocumentHtmlToLocationBody(focus, canonical);
    const stripMatch = canonical.match(/data-loc-strip="(\d)"/);
    expect(stripMatch).not.toBeNull();
    expect(merged).toContain(`data-loc-strip="${stripMatch![1]}"`);
  });

  it("round-trips minimal legacy body without canvas role", () => {
    const legacy = `<div class="locHeader">
<div class="locName">Legacy Town</div>
<div class="locMetaLine"><span class="locMetaKey">Nation</span><span>Old Realm</span></div>
<div class="locMetaLine"><span class="locMetaKey">Site</span><span>Dock</span></div>
</div>
<div class="notesBlock"><div class="notesText"><p><br></p></div></div>`;
    const focus = locationBodyToFocusDocumentHtml(legacy);
    expect(focus).toContain("Legacy Town");
    const merged = focusDocumentHtmlToLocationBody(focus, legacy);
    expect(merged).toContain("Legacy Town");
    expect(merged).toContain("Old Realm");
  });
});

describe("shouldRenderLoreLocationCanvasNode", () => {
  it("returns true for loreCard location", () => {
    expect(
      shouldRenderLoreLocationCanvasNode({
        kind: "content",
        bodyHtml: "<p>x</p>",
        loreCard: { kind: "location", variant: "v2" },
      }),
    ).toBe(true);
  });

  it("returns false for character", () => {
    expect(
      shouldRenderLoreLocationCanvasNode({
        kind: "content",
        bodyHtml: "",
        loreCard: { kind: "character", variant: "v11" },
      }),
    ).toBe(false);
  });
});
