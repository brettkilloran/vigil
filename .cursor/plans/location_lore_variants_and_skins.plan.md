---
name: "Location lore variants & skins"
overview: "Design exploration for location node chrome beyond v1–v3: inventive spatial metaphors (blueprint, deed, polaroid, etc.) that stay honest to the stored field contract (name, optional context/detail, optional ref on v3, notes). Parity goal is character-style lab + seeds on the real canvas path—not static LabCard-only mocks. Depends on shipped persistence in location_lore_data_model_and_focus.plan.md."
todos:
  - id: pick-prototype-set
    content: "Product pick 2–3 directions to prototype first (from §2); record choice in plan or BUILD_PLAN"
    status: pending
  - id: prototype-seeds-css
    content: "For each pick: CSS in lore-entity-card.module.css + optional v4+ seed branch in lore-node-seed-html.ts; same data-* field contract as current location seeds"
    status: pending
  - id: lab-production-parity
    content: "Optional: /dev/lore-entity-nodes location row uses getLoreNodeSeedBodyHtml + loreLocationCanvasRoot (or LabSkeuo-style shell) so lab matches canvas HTML/CSS path; notes hidden on canvas like production"
    status: pending
  - id: focus-projection-skinned
    content: "If new chrome adds fields inside canonical HTML, extend lore-location-focus-document-html merge/projection + golden tests"
    status: pending
  - id: schema-decision-doc
    content: "Decide and document: stay HTML-first (labels + two optional lines only) vs hgArch.loreLocation sidecar for extra semantics—before building threat/weather/etc. as real fields"
    status: pending
isProject: false
---

# Location lore — variants, skins, and data honesty

This plan holds **design directions** and **constraints** for **location card chrome** (layouts, metaphors, typography). It is **not** the persistence/focus track (see **[`location_lore_data_model_and_focus.plan.md`](./location_lore_data_model_and_focus.plan.md)**). It complements the **nine lab explorations** in **[`lore_entity_node_lab.plan.md`](./lore_entity_node_lab.plan.md)** (`/dev/lore-entity-nodes`).

## 1. Context — what the spike already does

- **Character** is the **full-fidelity** lane in the lab: `LabSkeuoCard` + `getLoreNodeSeedBodyHtml("character", "v11")` — real canvas body classes, placeholders, portrait upload, same behaviors as production.
- **Location** in the lab is still mostly **static `LabCard`** compositions: **V1** site plaque (typed meta lines), **V2** postcard band (color strip), **V3** survey tag (strip + REF corner). Production seeds (`v1`–`v3`) now share a **single field contract** (see data model plan); lab previews may lag that parity.

**Gap:** less “more labels” and more **distinct spatial metaphors** you can back with **seeds + CSS** (and eventually the same HTML path as the canvas), like the character ID plate—not a second disconnected mock system.

## 2. Inventive location variants (design directions)

Each is a **skin / metaphor** candidate. Implementation must still bind to **§3** unless the product explicitly extends the schema.

| Direction | Idea |
|-----------|------|
| **Blueprint / survey sheet** | Faint drafting grid, scale bar, registration marks — “measured place” (buildings, ruins). Decorative grid is fine; a fake “scale” **field** needs a schema decision. |
| **Field journal header** | Expedition row: date / weather / observer (or season / biome). Narrative-first; if stored beyond notes, needs **slots or sidecar**. |
| **Crossroads / waypoint sign** | Fork / arrows + “toward …” placeholder copy; later could mirror `item_links`. |
| **Transit or service board** | Timetable / platform strip: lines served, hours, etc. |
| **Deed / cadastral slip** | Legal-fiction chrome — parcel, tenure, easement; strong for borders/property. **Ref** line or relabeled **context/detail** can carry some of this without new columns. |
| **Threat / access band** | Compact access / hazard / light row — TTRPG-native; same **info architecture** as a third **detail**-style line, different **meaning** in copy/CSS only if no new fields. |
| **Palimpsest / renamed place** | Ghosted secondary title or former name — high narrative payoff; can be **presentation** on **name** + optional second line if careful. |
| **Biome / climate stamp** | Circular chop / badge + elevation — “official reserve” vs tourist stripe. |
| **Receipt / ticket stub** | Perforation, monospace ticket no., valid window — venues, markets. |
| **Depth / pressure gauge** | Vertical ruler — mines, abyss, vertical dungeons. |
| **Sound / ambience meter** | Abstract bars or labels — sensory aid; keep prose in **notes** unless new fields. |
| **Memory shard (polaroid)** | Wide placeholder **image** region + caption — same upload story as character portrait; **template + projection + merge** change, not CSS-only. |

## 3. What the location model actually stores (contract)

Canonical **`bodyHtml`** (one string per item). Aligned with shipped seeds / focus (see data model plan):

| Slot | Role |
|------|------|
| **name** | Required primary place label; drives item **title** on focus save. |
| **context** | Optional — “where it sits in the world” (v1/v3 labeled “Nation” in copy; v2 may omit key). |
| **detail** | Optional — local frame (“Site”, “Detail”, “Kind” label copy per variant). |
| **ref** | Optional — v3-style short code / survey id. |
| **Notes** | Long-form HTML; **focus-first** editing in production. |

**Presentation-only** today: postcard band, plaque strip + `data-loc-strip`, extra borders — not separate DB columns unless you add them.

## 4. Safe vs risky (without lying to the model)

**Safe (data-honest)**

- Relabel **context/detail** keys in UI copy (`Nation` → `Region`, etc.) — same HTML shape.
- Reuse **ref** slot on more layouts as optional monospace “stamp”.
- **Decorative** chrome (grid, fork icon, perforation SVG) with **no** new persisted keys.

**Risky (needs explicit schema / `data-*` / migration)**

- Dedicated affordances for **threat tier, weather, depth, biome, lines served** as **structured** facts — not in the default contract today; either **prose in notes**, **`hgArch` sidecar**, or new **seed fields** + projection rules + docs/tests.

**Optional hero / map image**

- Real content in **`bodyHtml`** — like character portrait — requires **seed + detectors + focus merge** updates, not CSS alone.

## 5. Practical takeaway

- **Content** stays anchored to **name, context, detail, optional ref, notes** until the model extends.
- **Visual variants** = layout, typography, bands, stamps, optional **decorative** SVG/CSS, optional **shared media** block — not “new columns” unless the schema gains them.

**Open product question:** stay **HTML-first** (everything in the two optional lines + notes) vs introduce **`hgArch.loreLocation`** (or similar) for typed extras — that choice caps how “inventive” the UI can be without drift.

## 6. Related

- **[`location_lore_data_model_and_focus.plan.md`](./location_lore_data_model_and_focus.plan.md)** — shipped focus, notes hiding, merge, tests.
- **[`lore_entity_node_lab.plan.md`](./lore_entity_node_lab.plan.md)** — lab route, nine layouts, palette/create follow-ups.
- **[`vigil/docs/CANVAS_LORE_NODE_PATTERNS.md`](../vigil/docs/CANVAS_LORE_NODE_PATTERNS.md)** — hooks and canvas vs focus patterns.
