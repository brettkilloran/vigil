---
name: Lore entity node lab
overview: "Canvas-adjacent lore nodes for Character, Faction/org/company, and Location: fixed minimal field sets per type (per product feedback), plus nine visual explorations (three layouts per type). No extra RPG/social fields unless added later. Lab at /dev/lore-entity-nodes; future persistence via entity_type + hgArch."
todos:
  - id: lab-shipped
    content: "Design lab route + previews ([app/dev/lore-entity-nodes/page.tsx](vigil/app/dev/lore-entity-nodes/page.tsx), [LoreEntityNodeLab.tsx](vigil/src/components/dev/LoreEntityNodeLab.tsx)) reflect canonical fields + 3 visual passes per type"
    status: completed
  - id: pick-winners
    content: "Optional: expose v2/v3 in UI (palette, context menu); dock currently creates v1 only"
    status: pending
  - id: persist-hgarch
    content: "HgArch `loreCard` { kind, variant } + `entity_type` on create/restore; bridge infers v1 from entity_type when hg omits loreCard"
    status: completed
  - id: dock-create
    content: "Dock + hotkeys 6–8 create Character / Organization / Location (v1 seed body)"
    status: completed
isProject: false
---

# Lore entity node types — design lab and integration path (revised)

## What changed from the earlier draft

An earlier version of this plan listed **extra content** (pronouns, voice, bonds, AC/HP, motto, org chart sections, etc.). That is **out of scope**. The **only** structured fields are the ones specified below. Everything else lives in the **open document / notes** region so you can categorize and sort later without baking those concepts into the card chrome.

The **nine variants** are **not** nine different data models. They are **three visual/layout explorations** for each of three entity families, all respecting the same field contract per family.

## Content contract (canonical)

### Character

| Area | Purpose |
|------|--------|
| **Image** | ID / badge-style portrait (uploaded URL in production; lab uses a placeholder). |
| **First name** | Required structured line. |
| **Last name** | Required structured line. |
| **Affiliation** | Faction, organization, company, etc. (may link to an org node later). |
| **Nationality** | In-world / fictional nation. |
| **Notes** | Unstructured document: hooks, tags-as-text, anything you will categorize later—**not** separate chrome fields. |

### Faction / organization / company (letterhead family)

| Area | Purpose |
|------|--------|
| **Name** | Primary org title. |
| **Nation** | Fictional nation or polity context. |
| **Document** | Everything else—charter, structure, fronts, relationships—**glorified document** below the letterhead. |

Letterhead should stay **versatile and reusable**: not bland default note, but **not** over-decorated so it works for guilds, corps, cults, governments, etc.

### Location (any scale of site)

| Area | Purpose |
|------|--------|
| **Name** | Place title (nation, city, building, etc.—same template). |
| **Nation** | In-world nation / polity when relevant. |
| **Third line** | **Flexible label + value** (e.g. site type, ward, grid ref, district—“Kind”, “Site”, “Detail”, etc.—user- or template-chosen). |
| **Notes** | Unstructured document for sensory detail, rumors, clocks—same “open ended” rule as character notes. |

## Nine variants = visual only

Each row shares **one** data model; columns differ by **layout, typography, tape choice, and decorative vocabulary** while keeping the shared canvas shell ([`ArchitecturalCanvasApp.module.css`](vigil/src/components/foundation/ArchitecturalCanvasApp.module.css) `.entityNode`, header, tape, shadows, selection affordances).

Implementation labels in the lab ([`LoreEntityNodeLab.tsx`](vigil/src/components/dev/LoreEntityNodeLab.tsx)):

| Type | V1 | V2 | V3 |
|------|----|----|-----|
| **Character** | Credential split (photo + field grid) | Crest portrait (hero band + round badge photo) | Passport strip (mono bureaucratic header + photo) |
| **Organization** | Classic centered letterhead + mark | Monogram rail (asymmetric stationery) | Framed memorandum (typographic frame) |
| **Location** | Site plaque (serif title + labeled lines) | Postcard band (gradient band, no image required) | Survey tag (optional ref code + labeled third line) |

No variant adds pronouns, voice, stats, motto blocks, or other fields unless the product explicitly expands the contract later.

## Technical consistency (unchanged)

- **Body editing on canvas** can stay `ContentTheme: "default"` for rich notes; visual profile is orthogonal (e.g. `content_json.hgArch.cardVariant` + `items.entity_type`).
- **Persistence direction:** [`HgArchPayload`](vigil/src/components/foundation/architectural-db-bridge.ts) gains optional keys for variant; [`entityType`](vigil/src/model/canvas-types.ts) uses values such as `character`, `faction`, `location` (or your final enum strings).
- **Lab route:** [`/dev/lore-entity-nodes`](vigil/app/dev/lore-entity-nodes/page.tsx), `robots: noindex`.

## Follow-up (after design sign-off)

1. Map chosen variant(s) to `hgArch` and render extra classes on [`ArchitecturalNodeCard`](vigil/src/components/foundation/ArchitecturalNodeCard.tsx) (or a thin wrapper).
2. Seed `bodyHtml` templates in [`createNewNode`](vigil/src/components/foundation/ArchitecturalCanvasApp.tsx) / dock ([`ArchitecturalBottomDock`](vigil/src/components/foundation/ArchitecturalBottomDock.tsx)) for the three kinds.
3. Optional: Storybook story that reuses the lab grid component for regression visibility.
