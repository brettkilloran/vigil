# PRD — Faction (organization) lore node entity

**Status:** draft (implementation partially primed)  
**Audience:** product, design, engineering  
**Related:** [`FACTION_LORE_ENTITY_CHECKLIST.md`](./FACTION_LORE_ENTITY_CHECKLIST.md), [`CANVAS_LORE_NODE_PATTERNS.md`](./CANVAS_LORE_NODE_PATTERNS.md), [`faction-roster-schema.ts`](../src/lib/faction-roster-schema.ts), [`lore-node-seed-html.ts`](../src/lib/lore-node-seed-html.ts), [`LoreEntityNodeLab.tsx`](../src/components/dev/LoreEntityNodeLab.tsx)

---

## 1. Summary

The **faction** lore entity represents an in-world organization, guild, government office, syndicate, or similar group on the infinite canvas. It is one of three dedicated lore shells (`character`, `faction`, `location`). This PRD defines the **target experience** so faction cards match the **craft and clarity** of **character v11** (credential plate) and **location v7** (ORDO slab): bespoke visual identity, predictable field semantics, structured data where the product needs queryability, and **long-form prose** edited with the same **styled TipTap / Heartgarden doc** affordances as other lore surfaces—not a generic note body.

**Today:** faction nodes render inside the default A4 note chrome with seeded **letterhead** HTML (`v1`–`v3`) and use **`BufferedContentEditable`** for the whole body. They do **not** yet have a dedicated **`ArchitecturalLoreFactionCanvasNode`**, a **`faction-hybrid`** focus surface, or HTML ↔ focus **projection** like character and location. Structured roster data is **specified** in Zod (`hgArch.factionRoster`) but is **not** fully wired through create/sync/UI.

---

## 2. Goals

1. **Visual parity (canvas):** Faction cards should feel as **intentional and premium** as character and location cards: distinct typography, materials, spacing, and motion—implemented in `lore-entity-card.module.css` (and canvas chrome in `ArchitecturalCanvasApp.module.css`) with **stable `data-hg-*` hooks**, not fragile class-name matching alone.
2. **Progressive disclosure:** Canvas shows **identity + roster summary + optional teaser**; long-form charter / politics / history lives in a **prose region** that may be **visually de-emphasized or hidden on canvas** (pattern from character notes row and location notes cell).
3. **Styled TipTap for prose:** The **document / charter** region uses the **Heartgarden doc stack** (TipTap-derived `HeartgardenDocEditor` + shared marks/blocks) with **lore-appropriate chrome** (same family of styling as focus notes for character/location), scoped so **inline identity fields** (org name, jurisdiction, tagline) remain **plain contenteditable or single-block** editing—not full slash-command blocks in the title strip.
4. **Data model clarity:** Persist:
   - **`items.entity_type === "faction"`**
   - **`content_json.hgArch.loreCard`:** `{ kind: "faction", variant: … }`
   - **Canonical HTML body** with versioned structure (`data-hg-canvas-role`, variant attribute).
   - **`content_json.hgArch.factionRoster`:** validated array linking **character items** and/or **unlinked** rows ([`faction-roster-schema.ts`](../src/lib/faction-roster-schema.ts)).
5. **Single detection helper:** One predicate (e.g. `shouldRenderLoreFaction…CanvasNode`) + optional `bodyHtmlImplies…` for legacy seeds—used for canvas, focus resolution, and labs ([`CANVAS_LORE_NODE_PATTERNS.md`](./CANVAS_LORE_NODE_PATTERNS.md) §2–3).

---

## 3. Non-goals (v1)

- Replacing **item_links** with roster-only graph semantics (edges remain first-class; roster is **membership UX + structured index**, not the only relationship model).
- Full **CRDT** merge for roster vs body (follow existing PATCH / last-write patterns).
- A separate **second editor tree** in focus that duplicates the canvas card (“card in a card”)—rejected pattern; prefer **one focus body** + projection merge like character/location.

---

## 4. Users and scenarios

| Actor | Need |
|--------|------|
| **GM / author** | Create a faction quickly, name it, attach members, write charter text with rich formatting and wiki links. |
| **Player (read-heavy)** | Scan the canvas card for **who belongs** and **what the group is** without opening focus. |
| **Search / MCP / API** | Find factions by name, roster labels, and prose; optional future: roster-driven queries. |

---

## 5. Current implementation snapshot (code)

| Area | Character | Location | Faction (today) |
|------|-----------|----------|-------------------|
| Seed HTML | `characterV11()` in [`lore-node-seed-html.ts`](../src/lib/lore-node-seed-html.ts) | ORDO v7 + older variants | `factionV1`–`V3()` letterhead + notes block |
| Dedicated canvas shell | [`ArchitecturalLoreCharacterCanvasNode.tsx`](../src/components/foundation/ArchitecturalLoreCharacterCanvasNode.tsx) | [`ArchitecturalLoreLocationCanvasNode.tsx`](../src/components/foundation/ArchitecturalLoreLocationCanvasNode.tsx) | **None** — uses default [`ArchitecturalNodeCard`](../src/components/foundation/ArchitecturalNodeCard.tsx) |
| Focus surface | `character-hybrid` + projection | `location-hybrid` + projection | **`default-doc`** (no hybrid) |
| Structured extras | Portrait / media in HTML | Location fields + notes | **`factionRoster`** schema only (primed) |
| Design lab | Skeu card stack | ORDO slab match | **[`LoreEntityNodeLab`](../src/components/dev/LoreEntityNodeLab.tsx)** — many `FactionLabPlate` specimens |

Tape variants for faction: [`tapeVariantForLoreCard`](../src/lib/lore-node-seed-html.ts) maps `v2` → masking tape, else clear (`v1`/`v3`).

---

## 6. Information architecture

### 6.1 Canonical fields (HTML body)

Align with existing patterns:

- **Identity:** organization display name, **jurisdiction / realm / nation** (or setting-appropriate second line), optional **monogram / sigil** slot (variant-dependent).
- **Prose:** “Charter” / “Document” / “Mandate” — **TipTap-capable** region (headings, lists, block quote, links, pending AI marks per global lore rules).
- **Canvas-only suppression:** Long prose may be **hidden or collapsed** on canvas via **canvas-root CSS** (see `.loreLocationCanvasRoot` / character notes hiding).

All regions that participate in focus merge should carry **stable `data-hg-lore-faction-*`** (exact names TBD during implementation; follow [`data-hg-lore-location-*`](../src/lib/lore-node-seed-html.ts) precedent).

### 6.2 Structured roster (`hgArch.factionRoster`)

Per [`faction-roster-schema.ts`](../src/lib/faction-roster-schema.ts):

- **`character` rows:** `characterItemId` (UUID), optional `displayNameOverride`, `roleOverride`.
- **`unlinked` rows:** `label`, optional `role` for NPCs not yet promoted to character cards.

**UI:** Roster renders as a **scrollable list** on canvas (compact) with **add / link / unlink** actions in focus or inline where safe. **Source of truth** is `hgArch`, not duplicated prose lists—optional one-way **summary line** in HTML for search if needed.

### 6.3 Variants (`loreCard.variant`)

Existing seeds: **v1** centered letterhead, **v2** asym + monogram, **v3** framed. Target UX:

- Variants are **visual skins**; **field semantics and roster behavior** stay consistent across variants (same as location v2/v3/v7 share field names).

---

## 7. Canvas experience

- **Node chrome:** Either retain A4 tape + header **or** adopt a **faction-specific outer wrapper** (like character’s non-default theme) so credential-like plates are not fighting the default document mat. Decision belongs to design; engineering constraint is **one React shell component** per [`CANVAS_LORE_NODE_PATTERNS.md`](./CANVAS_LORE_NODE_PATTERNS.md) §1.
- **Drag affordances:** Reuse established **drag header** / expand button patterns (`data-hg-lore-canvas-drag-header`, `data-expand-btn`) as on character and location.
- **Width:** Default lore dimensions already match other lore shells (see [`docs/API.md`](./API.md) create-item defaults).
- **Roster on canvas:** Show **top N** members with “+N more” or full list with max-height + fade—avoid unbounded height on the graph.

---

## 8. Focus experience

- **Single focus surface:** Extend `focusSurface` with **`faction-hybrid`** (naming parallel to existing enum in [`ArchitecturalCanvasApp.tsx`](../src/components/foundation/ArchitecturalCanvasApp.tsx)).
- **One `BufferedContentEditable` / body host:** Same as character and location—**project** opened HTML to a **flatter focus document** and **merge back** on save via a new module (e.g. `lore-faction-focus-document-html.ts`) following the **DOMParser** approach in character/location.
- **TipTap / rich formatting:** Slash commands and block formatting apply only when the caret is inside the **prose subtree** (mirror `isRichDocBodyFormattingTarget` scoping for character notes / location notes—see [`CANVAS_LORE_NODE_PATTERNS.md`](./CANVAS_LORE_NODE_PATTERNS.md) §5–6).
- **Title:** Graph title sync rules should match location/character: **display name field** drives **`items.title`** on save where applicable.

---

## 9. Styled TipTap — requirements

1. **Prose region** serializes to HTML compatible with **`HeartgardenDocEditor`** (or the same pipeline location v7 uses for **notes**: `generateHTML` / hgDoc—see [`LoreLocationOrdoV7Slab`](../src/components/foundation/LoreLocationOrdoV7Slab.tsx) and [`buildLocationOrdoV7BodyHtml`](../src/lib/lore-node-seed-html.ts)).
2. **Shared marks:** `hgAiPending`, wiki links, and theme tokens from [`app/globals.css`](../app/globals.css) / lore card module—**no orphan stylesheet** that drifts from the rest of Heartgarden.
3. **Inline fields** outside the prose subtree use **minimal** formatting (no block inserts) to prevent broken layouts.
4. **Lab parity:** Production markup should be testable on **`/dev/lore-entity-nodes`** with the same hooks as canvas.

---

## 10. Persistence and APIs

- **Create / PATCH:** [`architectural-db-bridge.ts`](../src/components/foundation/architectural-db-bridge.ts) must preserve **`hgArch.loreCard`** and **`hgArch.factionRoster`** round-trip (checklist in [`FACTION_LORE_ENTITY_CHECKLIST.md`](./FACTION_LORE_ENTITY_CHECKLIST.md)).
- **Search:** Roster strings should contribute to **`content_text`** or indexing policy (align with character/location behavior—see audit notes in [`DATA_PIPELINE_AUDIT_2026-04-11.md`](./DATA_PIPELINE_AUDIT_2026-04-11.md)).

---

## 11. Success criteria

1. Faction nodes are **visually on-brand** next to character v11 and location v7 on the canvas at a glance.
2. Authors can **edit charter prose** with **bold, lists, links, and blocks** without breaking the identity strip.
3. **Roster** edits survive reload, sync, and import/export of `content_json`.
4. Focus mode feels like **one document**, not nested cards.
5. **`pnpm run check`** + lab page smoke path stay green.

---

## 12. Phased delivery (suggested)

| Phase | Scope |
|-------|--------|
| **P0** | Stable `data-hg-*` + one detection helper; lock one **primary** visual direction (can fold lab `FactionLabPlate` learning into production CSS). |
| **P1** | `ArchitecturalLoreFactionCanvasNode` + canvas-only CSS; seed HTML migration for new nodes; optional legacy detection. |
| **P2** | `faction-hybrid` focus + `lore-faction-focus-document-html` merge pipeline; prose subtree → TipTap/hgDoc. |
| **P3** | Full **`factionRoster`** UI (link to character items, unlinked rows), sync with graph actions as needed. |

---

## 13. Open questions

1. **Canonical variant set:** Keep v1–v3 letterheads or replace with a single **“ORDO-style”** org slab for parity with location v7?
2. **Iconography:** Monogram only vs optional uploaded **seal / emblem** (character portrait pattern)?
3. **Roster vs links:** When a user links a character in the graph, do we **auto-suggest** adding them to `factionRoster`?
4. **Import:** How do imported faction notes map into `factionRoster` vs body-only prose?

---

## 14. References

- Integration checklist: [`FACTION_LORE_ENTITY_CHECKLIST.md`](./FACTION_LORE_ENTITY_CHECKLIST.md)
- Canvas patterns: [`CANVAS_LORE_NODE_PATTERNS.md`](./CANVAS_LORE_NODE_PATTERNS.md)
- Import mapping: [`LORE_IMPORT_KIND_MAPPING.md`](./LORE_IMPORT_KIND_MAPPING.md)
