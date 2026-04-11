---
name: "Location lore data model & focus"
overview: "Persistence + focus for location lore: one bodyHtml with name/context/detail (+ optional ref on v3), notes hidden on canvas and edited in location-hybrid focus. This is NOT the visual 'card type' lab (plaque/postcard/survey layouts)—see lore_entity_node_lab.plan.md for those nine explorations and palette wiring."
todos:
  - id: shipped-seeds-hooks
    content: "Seeds + stable data-* hooks in [lore-node-seed-html.ts](heartgarden/src/lib/lore-node-seed-html.ts); shouldRenderLoreLocationCanvasNode + legacy detection"
    status: completed
  - id: shipped-focus-canvas
    content: "Focus projection/merge + title sync in [lore-location-focus-document-html.ts](heartgarden/src/lib/lore-location-focus-document-html.ts); location-hybrid surface + save in [ArchitecturalCanvasApp.tsx](heartgarden/src/components/foundation/ArchitecturalCanvasApp.tsx); loreLocationCanvasRoot + CSS hide notes ([ArchitecturalNodeCard.tsx](heartgarden/src/components/foundation/ArchitecturalNodeCard.tsx), [ArchitecturalCanvasApp.module.css](heartgarden/src/components/foundation/ArchitecturalCanvasApp.module.css))"
    status: completed
  - id: harden-golden-tests
    content: "Golden fixtures: projection round-trip, plainPlaceNameFromLocationBodyHtml / title on save, legacy + modern body samples"
    status: completed
  - id: docs-crosslink
    content: "Short pointer + required data-* hooks in [CANVAS_LORE_NODE_PATTERNS.md](heartgarden/docs/CANVAS_LORE_NODE_PATTERNS.md) (same pattern as character v11)"
    status: completed
  - id: collab-conflict-smoke
    content: "Smoke-test focus open + server PATCH / conflict queue re-projects location body via projectBodyHtmlForFocus"
    status: pending
  - id: lab-canvas-parity
    content: "Optional: /dev/lore-entity-nodes uses seeded location HTML + loreLocationCanvasRoot so lab matches canvas (notes hidden unless focus preview toggle)"
    status: pending
  - id: visual-variants-contract
    content: "New location skins (v4+): layout only; must map to name/context/detail/ref/notes unless product adds structured fields + migration"
    status: pending
  - id: optional-hero-media
    content: "Optional: landscape/map slot via data-architectural-media-root on location seed + upload + merge/projection + tests"
    status: pending
  - id: optional-hgarch-sidecar
    content: "Optional Track B: hgArch.loreLocation JSON + parse/serialize + golden tests (see CHARACTER_FOCUS_AND_DATA_MODEL_PLAN)"
    status: pending
  - id: lazy-body-migration
    content: "Optional: idempotent rewriter injects data-hg-canvas-role + field attrs into legacy bodies; then tighten or remove legacy heuristic"
    status: pending
isProject: false
---

# Location lore — data model, canvas vs focus

## What this plan is **not**

- **Not** the design spike for **location card chrome** (site plaque vs postcard band vs survey tag, extra inventive skins). That work lives under **[`lore_entity_node_lab.plan.md`](./lore_entity_node_lab.plan.md)** (`/dev/lore-entity-nodes`) and todos like **pick-winners** (expose v2/v3 in create UI).
- **Not** new `loreCard.variant` values by themselves—this plan assumes **v1 | v2 | v3** seeds already differ by **layout chrome** on the same **field contract** below.

This file is the **field contract + storage + focus merge** track (character parity), so canvas cards stay short while notes stay full-fidelity in focus.

---

Aligns **UI**, **persistence**, and **future variants** with character-style rules: **one canonical `bodyHtml`**, **structured identity on the canvas**, **long-form notes primarily in focus**. Complements **[`heartgarden/docs/CHARACTER_FOCUS_AND_DATA_MODEL_PLAN.md`](../heartgarden/docs/CHARACTER_FOCUS_AND_DATA_MODEL_PLAN.md)** and **[`heartgarden/docs/CANVAS_LORE_NODE_PATTERNS.md`](../heartgarden/docs/CANVAS_LORE_NODE_PATTERNS.md)**.

## Content contract (canonical HTML)

| Slot | Role |
|------|------|
| **name** | Required; plain text drives graph **item title** on focus save. |
| **context** | Optional; parent region / polity / parent place. |
| **detail** | Optional; local frame (district, site type, layer, etc.). |
| **ref** | Optional; location v3 only — short reference / survey code. |
| **Notes** | Full HTML in body; **hidden on canvas**; rich editing in **location-hybrid** focus (slash/blocks scoped to notes region). |

Root: `data-hg-canvas-role="lore-location"`. Variant: `data-hg-lore-location-variant` (`v1` | `v2` | `v3`). Field nodes: `data-hg-lore-location-field="name" | "context" | "detail" | "ref"`. Notes: `data-hg-lore-location-notes` inside `data-hg-lore-location-notes-cell`.

## Invariants

1. Single **`bodyHtml`**; **`hgArch.loreCard`** stays `{ kind: "location", variant: "v1" | "v2" | "v3" }` for tape defaults.
2. **Merge / detection** tolerate **legacy** bodies (no root role) until optional migration.
3. **Variant chrome** (postcard band, `data-loc-strip`, `ref`) is presentation on top of the same semantic slots.

## Shipped (baseline) — see completed todos

Implementation pointers: [`heartgarden/src/lib/lore-node-seed-html.ts`](../heartgarden/src/lib/lore-node-seed-html.ts), [`heartgarden/src/lib/lore-location-focus-document-html.ts`](../heartgarden/src/lib/lore-location-focus-document-html.ts), [`heartgarden/src/components/foundation/ArchitecturalCanvasApp.tsx`](../heartgarden/src/components/foundation/ArchitecturalCanvasApp.tsx), [`heartgarden/src/components/foundation/ArchitecturalNodeCard.tsx`](../heartgarden/src/components/foundation/ArchitecturalNodeCard.tsx), [`heartgarden/src/components/foundation/ArchitecturalCanvasApp.module.css`](../heartgarden/src/components/foundation/ArchitecturalCanvasApp.module.css).

## Success criteria

- **Data:** `loreCard` + `bodyHtml` round-trip; title matches **name** after focus save.
- **UX:** Canvas = identity lines only; focus = structured fields + full notes.
- **Engineering:** Hooks documented; golden tests guard projection/merge once added.

## Related

- **[`location_lore_variants_and_skins.plan.md`](./location_lore_variants_and_skins.plan.md)** — inventive location **skins/metaphors** (blueprint, deed, polaroid, etc.) within the same field contract.
- **[`lore_entity_node_lab.plan.md`](./lore_entity_node_lab.plan.md)** — `/dev/lore-entity-nodes` nine-layout lab and palette/create follow-ups.
