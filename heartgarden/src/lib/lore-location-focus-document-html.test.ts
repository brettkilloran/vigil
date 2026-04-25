/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";

import {
  computeLocationTopFieldPasteInsertText,
  extractLocationMetaFocusShellHtml,
  focusDocumentHtmlToLocationBody,
  LOCATION_TOP_FIELD_CHAR_CAPS,
  locationBodyToFocusDocumentHtml,
  normalizeLocationTopFieldPlain,
  parseLocationFocusDocumentHtml,
  parseLocationOrdoV7BodyPlainFields,
  plainPlaceNameFromLocationBodyHtml,
  readLocationFocusPartsFromMetaHost,
  shouldBlockLocationTopFieldBeforeInput,
  trimLocationTopFieldForImport,
} from "@/src/lib/lore-location-focus-document-html";
import {
  getLoreNodeSeedBodyHtml,
  shouldRenderLoreLocationCanvasNode,
} from "@/src/lib/lore-node-seed-html";

describe("plainPlaceNameFromLocationBodyHtml", () => {
  it("reads modern name field", () => {
    const body = `<div data-hg-canvas-role="lore-location">
<div data-hg-lore-location-field="name">Harbor Kiln</div>
</div>`;
    expect(plainPlaceNameFromLocationBodyHtml(body)).toBe("Harbor Kiln");
  });

  it("treats legacy seed literal Place name as empty", () => {
    const body = `<div data-hg-canvas-role="lore-location">
<div data-hg-lore-location-field="name">Place name</div>
</div>`;
    expect(plainPlaceNameFromLocationBodyHtml(body)).toBe("");
  });

  it("strips legacy Place name prefix before real title", () => {
    const body = `<div data-hg-canvas-role="lore-location">
<div data-hg-lore-location-field="name">Place name Pacific Station</div>
</div>`;
    expect(plainPlaceNameFromLocationBodyHtml(body)).toBe("Pacific Station");
  });

  it("strips glued legacy Place name prefix (no space)", () => {
    const body = `<div data-hg-canvas-role="lore-location">
<div data-hg-lore-location-field="name">Place nameOrbital Nine</div>
</div>`;
    expect(plainPlaceNameFromLocationBodyHtml(body)).toBe("Orbital Nine");
  });

  it("treats literal ORDO v7 placeholder label as empty", () => {
    const body = `<div data-hg-canvas-role="lore-location">
<div data-hg-lore-location-field="name">PLACENAME</div>
</div>`;
    expect(plainPlaceNameFromLocationBodyHtml(body)).toBe("");
  });

  it("treats splitOrdoV7 empty sentinel as empty placename", () => {
    const body = `<div data-hg-canvas-role="lore-location">
<div data-hg-lore-location-field="name">UNTITLED</div>
</div>`;
    expect(plainPlaceNameFromLocationBodyHtml(body)).toBe("");
  });

  it("reads legacy locName", () => {
    const body = `<div class="x_locHeader_y"><div class="x_locName_y">Old Pier</div></div>`;
    expect(plainPlaceNameFromLocationBodyHtml(body)).toBe("Old Pier");
  });

  it("returns empty when missing", () => {
    expect(plainPlaceNameFromLocationBodyHtml("<div></div>")).toBe("");
  });

  it("preserves spaces across ORDO v7 two-line name (<br>)", () => {
    const body = `<div data-hg-canvas-role="lore-location">
<div data-hg-lore-location-field="name">ARBITER STATION<br />LAGRANGE 1</div>
</div>`;
    expect(plainPlaceNameFromLocationBodyHtml(body)).toBe(
      "ARBITER STATION LAGRANGE 1"
    );
    expect(parseLocationOrdoV7BodyPlainFields(body).name).toBe(
      "ARBITER STATION LAGRANGE 1"
    );
  });
});

describe("location hybrid meta shell", () => {
  it("extracts meta shell from full focus document and reads fields from live host", () => {
    const canonical = getLoreNodeSeedBodyHtml("location", "v2");
    const focus = locationBodyToFocusDocumentHtml(canonical);
    const shell = extractLocationMetaFocusShellHtml(focus);
    expect(shell).toContain("data-hg-location-focus-doc");
    expect(shell).toContain("data-hg-lore-location-focus-meta");
    expect(shell).not.toContain("data-hg-lore-location-focus-notes");

    const doc = new DOMParser().parseFromString(
      `<div id="h">${shell}</div>`,
      "text/html"
    );
    const host = doc.getElementById("h");
    const meta = host?.querySelector<HTMLElement>(
      '[data-hg-lore-location-focus-meta="true"]'
    );
    expect(meta).not.toBeNull();
    const parts = readLocationFocusPartsFromMetaHost(meta!, "<p><br></p>");
    const full = parseLocationFocusDocumentHtml(focus);
    expect(full).not.toBeNull();
    expect(parts.name).toBe(full?.name);
    expect(parts.context).toBe(full?.context);
    expect(parts.detail).toBe(full?.detail);
    expect(parts.hasRef).toBe(full?.hasRef);
  });
});

describe("location focus projection round-trip", () => {
  it("does not embed legacy Place name into focus name field", () => {
    const body = `<div data-hg-canvas-role="lore-location">
<div data-hg-lore-location-field="name">Place name Drydock</div>
<div data-hg-lore-location-field="context"><br></div>
<div data-hg-lore-location-field="detail"><br></div>
<div data-hg-lore-location-notes="true"><p><br></p></div>
</div>`;
    const focus = locationBodyToFocusDocumentHtml(body);
    const doc = new DOMParser().parseFromString(
      `<div id="w">${focus}</div>`,
      "text/html"
    );
    const nameField = doc.querySelector(
      '[data-hg-lore-location-focus-field="name"]'
    );
    expect(
      (nameField?.textContent || "").replace(/\s+/g, " ").trim().toLowerCase()
    ).toBe("drydock");
  });

  it("round-trips modern v2 seed: notes and fields merge back; chrome preserved", () => {
    const canonical = getLoreNodeSeedBodyHtml("location", "v2");
    const focus = locationBodyToFocusDocumentHtml(canonical);
    expect(focus).toContain("data-hg-location-focus-doc");
    expect(focus).toContain("data-hg-lore-location-focus-notes");

    const wrapped = `<div id="__hg_rt">${focus}</div>`;
    const doc = new DOMParser().parseFromString(wrapped, "text/html");
    const host = doc.getElementById("__hg_rt");
    expect(host).not.toBeNull();
    const notesEl = host?.querySelector<HTMLElement>(
      '[data-hg-lore-location-focus-notes="true"]'
    );
    expect(notesEl).not.toBeNull();
    notesEl!.innerHTML = "<p>Smoke note</p>";
    const editedFocus = host?.innerHTML;
    const merged = focusDocumentHtmlToLocationBody(editedFocus, canonical);
    expect(merged).toContain('data-hg-canvas-role="lore-location"');
    expect(merged).toContain("Smoke note");
    expect(merged).toContain('data-hg-lore-location-field="name"');
  });

  it("round-trips location v3 seed: strip attribute survives merge", () => {
    const canonical = getLoreNodeSeedBodyHtml("location", "v3", {
      locationStripSeed: "fixture-seed",
    });
    expect(canonical).toMatch(/data-loc-strip="\d"/);
    const focus = locationBodyToFocusDocumentHtml(canonical);
    const merged = focusDocumentHtmlToLocationBody(focus, canonical);
    const stripMatch = canonical.match(/data-loc-strip="(\d)"/);
    expect(stripMatch).not.toBeNull();
    expect(merged).toContain(`data-loc-strip="${stripMatch?.[1]}"`);
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
      })
    ).toBe(true);
  });

  it("returns false for character", () => {
    expect(
      shouldRenderLoreLocationCanvasNode({
        kind: "content",
        bodyHtml: "",
        loreCard: { kind: "character", variant: "v11" },
      })
    ).toBe(false);
  });
});

function makeEditableHost(text: string): HTMLDivElement {
  const el = document.createElement("div");
  el.setAttribute("contenteditable", "true");
  el.textContent = text;
  document.body.appendChild(el);
  return el;
}

function setTextSelection(el: HTMLElement, start: number, end: number) {
  const node = el.firstChild;
  if (!(node instanceof Text)) {
    return;
  }
  const sel = document.getSelection();
  if (!sel) {
    return;
  }
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  sel.removeAllRanges();
  sel.addRange(range);
}

describe("location top field caps", () => {
  it("trims import fields to tight caps", () => {
    const rawName = `  ${"N".repeat(80)}  `;
    const rawContext = `${"C".repeat(90)}`;
    const rawDetail = `${"D".repeat(120)}`;
    const name = trimLocationTopFieldForImport("name", rawName);
    const context = trimLocationTopFieldForImport("context", rawContext);
    const detail = trimLocationTopFieldForImport("detail", rawDetail);
    expect(name.value.length).toBe(LOCATION_TOP_FIELD_CHAR_CAPS.name);
    expect(context.value.length).toBe(LOCATION_TOP_FIELD_CHAR_CAPS.context);
    expect(detail.value.length).toBe(LOCATION_TOP_FIELD_CHAR_CAPS.detail);
    expect(name.wasTrimmed).toBe(true);
    expect(context.wasTrimmed).toBe(true);
    expect(detail.wasTrimmed).toBe(true);
  });

  it("normalizes whitespace in top fields", () => {
    expect(normalizeLocationTopFieldPlain("name", "  ORDO   DELTA  ")).toBe(
      "ORDO DELTA"
    );
    expect(normalizeLocationTopFieldPlain("context", "  one \n\n two   ")).toBe(
      "one two"
    );
    expect(normalizeLocationTopFieldPlain("detail", " \t deep   vault ")).toBe(
      "deep vault"
    );
  });

  it("blocks insertions beyond cap, allows deletions", () => {
    const capped = makeEditableHost(
      "N".repeat(LOCATION_TOP_FIELD_CHAR_CAPS.name)
    );
    const insert = new InputEvent("beforeinput", {
      inputType: "insertText",
      data: "X",
    });
    expect(shouldBlockLocationTopFieldBeforeInput("name", capped, insert)).toBe(
      true
    );
    const del = new InputEvent("beforeinput", {
      inputType: "deleteContentBackward",
    });
    expect(shouldBlockLocationTopFieldBeforeInput("name", capped, del)).toBe(
      false
    );
  });

  it("allows replacements that shorten legacy over-limit text", () => {
    const legacy = makeEditableHost("D".repeat(120));
    setTextSelection(legacy, 0, 50);
    const insert = new InputEvent("beforeinput", {
      inputType: "insertText",
      data: "short",
    });
    expect(
      shouldBlockLocationTopFieldBeforeInput("detail", legacy, insert)
    ).toBe(false);
  });

  it("clips paste to available room for capped fields", () => {
    const el = makeEditableHost("C".repeat(70));
    const clipped = computeLocationTopFieldPasteInsertText(
      "context",
      el,
      "ABCD1234"
    );
    expect(clipped).toBe("AB");
  });
});
