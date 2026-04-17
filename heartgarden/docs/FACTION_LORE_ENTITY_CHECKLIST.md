# Faction lore entity parity (integration checklist)

Use this when wiring faction cards to the canvas and APIs so they stay aligned with **character** and **location** lore shells.

## Identity and persistence

- [ ] `items.entity_type === "faction"` for the lore shell (matches [`persistedEntityTypeFromCanonical("faction")`](src/lib/lore-object-registry.ts)).
- [ ] `content_json.hgArch.loreCard` is `{ kind: "faction", variant: "v1" | "v2" | "v3" }` (or inferred from `entity_type` via [`architectural-db-bridge`](src/components/foundation/architectural-db-bridge.ts)).
- [ ] Item type for lore create paths remains **`note` or `sticky`** per existing lore guards.

## Human-edited body vs machine-readable extras

- [ ] **Body:** HTML (or hgDoc if faction prose ever moves) with stable **`data-hg-*`** field markers for editable regions—same *pattern class* as character (`data-hg-lore-field` / portrait roots) and location (`data-hg-lore-location-field`).
- [ ] **Structured roster:** `content_json.hgArch.factionRoster` (canonical array; see [`faction-roster-schema.ts`](../src/lib/faction-roster-schema.ts))—not only free-form document text, so lists stay queryable and in sync with UI.

## Graph and threads

- [ ] Card-to-card edges use normal [`item_links`](src/db/schema.ts); `link_type` values follow existing lore link semantics (e.g. organization ties). Roster membership is **not** required to duplicate every edge unless you add explicit sync rules later.

## Sync, restore, and search

- [ ] Round-trip through [`buildContentJsonForContentEntity`](src/components/foundation/architectural-db-bridge.ts) / `canvasItemToEntity` preserves `hgArch.loreCard` and `hgArch.factionRoster`.
- [ ] Plain text / search behavior: roster contributes to discoverability if you merge labels into `content_text` or extend search indexing (follow whatever character/location do today).

## Priming vs production templates

- [ ] **Priming/demo** specimens may live in [`LoreEntityNodeLab`](src/components/dev/LoreEntityNodeLab.tsx) only; **production** faction seed HTML in [`lore-node-seed-html.ts`](src/lib/lore-node-seed-html.ts) should be updated only when layout is locked.
