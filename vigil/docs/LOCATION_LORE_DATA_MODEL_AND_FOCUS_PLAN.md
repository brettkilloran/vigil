# Plan: Location lore — data model, canvas vs focus, and follow-ups

This document aligns **UI**, **persistence**, and **future variants** for **location** lore nodes with the same principles as character nodes: **one canonical `bodyHtml`**, **structured identity lines on the canvas**, **long-form notes primarily in focus**. It complements **`CHARACTER_FOCUS_AND_DATA_MODEL_PLAN.md`** and **`CANVAS_LORE_NODE_PATTERNS.md`**.

---

## 1. Goals

1. **Three structured lines in stored HTML**, with a clear contract:
   - **`name`** (required) — primary place identity; drives the graph **item title** on save from plain text.
   - **`context`** (optional) — parent region, polity, or parent place.
   - **`detail`** (optional) — local frame (district, site type, layer, etc.).
2. **Optional `ref`** (location v3 only) — short reference / survey code; still one editable region in HTML.
3. **Notes** — same storage model as character: **full HTML in `bodyHtml`**, **hidden on the infinite canvas**, **edited in focus** with rich text scoped to the notes region only.
4. **Backward compatibility** — existing rows without `data-hg-canvas-role="lore-location"` remain valid; detection and merge use **legacy heuristics** where needed.

---

## 2. Shipped implementation (baseline)

| Concern | Implementation |
|--------|------------------|
| **Stable hooks** | Root `data-hg-canvas-role="lore-location"`, `data-hg-lore-location-variant`, fields `data-hg-lore-location-field="name\|context\|detail"` (+ `ref` on v3), notes `data-hg-lore-location-notes` inside `data-hg-lore-location-notes-cell`. |
| **Seeds** | `getLoreNodeSeedBodyHtml("location", v1\|v2\|v3)` in **`src/lib/lore-node-seed-html.ts`** emits the above. |
| **Canvas: hide notes** | **`ArchitecturalNodeCard`**: `loreCard.kind === "location"` → `loreLocationCanvasRoot`. CSS: **`.loreLocationCanvasRoot [data-hg-lore-location-notes-cell] { display: none }`** in **`ArchitecturalCanvasApp.module.css`**. |
| **Focus projection** | **`src/lib/lore-location-focus-document-html.ts`**: `locationBodyToFocusDocumentHtml` / `focusDocumentHtmlToLocationBody`, plus **`plainPlaceNameFromLocationBodyHtml`** for title sync. |
| **Focus surface** | **`location-hybrid`** in **`ArchitecturalCanvasApp.tsx`**: dark scrim, no separate title field, **`focusLocationDocument`** styles, slash/blocks only in **`data-hg-lore-location-focus-notes`** (`isRichDocBodyFormattingTarget`). |
| **Save** | Merge focus → canonical template; **title** = plain **`name`** or **`defaultTitleForLoreKind("location")`**. |
| **Detection** | **`shouldRenderLoreLocationCanvasNode`**: `loreCard.kind === "location"` OR modern root marker OR legacy `locHeader` + `locName` + `notesText` heuristic. |

---

## 3. Invariants (do not break without migration)

1. **Single `bodyHtml`** per item; **`content_json.hgArch.loreCard`**** continues to carry `{ kind: "location", variant: "v1" \| "v2" \| "v3" }`** for tape/theme defaults.
2. **Detectors and merge** must tolerate **legacy HTML** until an explicit migration pass rewrites all location bodies to the modern root + `data-hg-lore-location-field` attributes.
3. **Canvas** must not rely on notes being visible for layout persistence; notes exist for **focus + search/plain text** (`htmlToPlainText` on the full body).
4. **Variant chrome** (postcard band, plaque strip + `data-loc-strip`, optional `ref`) is **presentation** layered on the same three-line + notes model — changing variant should not redefine field semantics without a version bump or migration note.

---

## 4. Work breakdown — remaining / optional

### Phase A — Hardening (recommended next)

1. **Golden fixtures** — 2–3 sample `bodyHtml` strings (empty seeds, legacy v1/v2/v3, filled notes) and assert:
   - `shouldRenderLoreLocationCanvasNode` / projection round-trip (`locationBodyToFocusDocumentHtml` → edit notes only → `focusDocumentHtmlToLocationBody` preserves variant chrome and field nodes).
   - `plainPlaceNameFromLocationBodyHtml` / save title behavior.
2. **Document invariants** in **`CANVAS_LORE_NODE_PATTERNS.md`** — short pointer to this file + list of required `data-*` hooks (same pattern as character v11).
3. **Collab / conflict** — When focus is open and server PATCH arrives, existing **`projectBodyHtmlForFocus`** path should re-project location bodies; smoke-test with a conflict queue scenario if not already covered for character.

### Phase B — Lab and visual variants

1. **`/dev/lore-entity-nodes`** — Optional: render **seeded** location bodies inside the same **`loreLocationCanvasRoot`** + node shell so the lab matches canvas (notes hidden unless “focus preview” toggle is added later).
2. **New card skins (v4+)** — Any inventive layout must **map to `name` / `context` / `detail` / optional `ref` / notes** only, unless the product adds **new structured fields** (then: seed change + `hgArch` or migration — see character plan Track B/C).

### Phase C — Optional product extensions

1. **Optional hero / map image** — Would mirror character portrait: add **`data-architectural-media-root`** (or agreed hook) to location seed + upload wiring + tests and update merge/projection.
2. **Structured sidecar** — `hgArch.loreLocation` JSON (Track B) only if HTML-first limits are hit; requires parse/serialize + golden tests per **`CHARACTER_FOCUS_AND_DATA_MODEL_PLAN.md`** guidance.

### Phase D — Lazy migration (only if needed)

1. One-shot or on-save rewriter: inject `data-hg-canvas-role="lore-location"` and field attributes into legacy bodies **idempotently**, then tighten **`bodyHtmlImpliesLoreLocationLegacy`** or remove it once data is clean.

---

## 5. Success criteria

- **Data:** Save/load/bootstrap/restore keep **`loreCard`** + single **`bodyHtml`** consistent; title stays aligned with **`name`** after focus save.
- **UX:** Canvas shows **identity lines only**; focus shows **structured fields + full notes** with the same editor affordances as other rich notes (within the notes region).
- **Engineering:** New hooks are **documented**; optional **golden tests** prevent regressions on projection and merge.

---

## 6. References (code)

- Seeds + **`shouldRenderLoreLocationCanvasNode`**: **`vigil/src/lib/lore-node-seed-html.ts`**
- Focus merge / title helper: **`vigil/src/lib/lore-location-focus-document-html.ts`**
- Focus shell, save, surface: **`vigil/src/components/foundation/ArchitecturalCanvasApp.tsx`**
- Canvas root on A4 location cards: **`vigil/src/components/foundation/ArchitecturalNodeCard.tsx`**
- CSS (hide notes + focus layout): **`vigil/src/components/foundation/ArchitecturalCanvasApp.module.css`**

Related: **`vigil/docs/CHARACTER_FOCUS_AND_DATA_MODEL_PLAN.md`**, **`vigil/docs/CANVAS_LORE_NODE_PATTERNS.md`**.
