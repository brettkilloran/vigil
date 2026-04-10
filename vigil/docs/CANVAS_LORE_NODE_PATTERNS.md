# Canvas lore node types — patterns and best practices

This guide is for adding **new alternate canvas item presentations** (lore cards, credential shells, custom bodies) that share the infinite canvas with generic note/code cards. It encodes lessons from character v11, focus mode, and progressive disclosure so the **next** variant is cheaper to ship.

## Goals

- **Configurable** — detection, seed HTML, and UI shell stay data-driven where possible (`loreCard`, theme, seed helpers).
- **Customizable** — styling lives in predictable CSS module boundaries; behavior hooks use **stable `data-*` attributes**, not fragile class-name assumptions.
- **Fewer fix cycles** — decide early: **canvas vs focus** responsibilities, **one** source of truth for “what kind of node is this?”, and **parse/compose** for any split focus model.

---

## 1. Where code lives (boundaries)

| Concern | Preferred location | Avoid |
|--------|---------------------|--------|
| Seed HTML for new lore bodies | `src/lib/lore-node-seed-html.ts` (or a colocated `lore-*-seed-html.ts` imported from there) | Duplicating full HTML strings in `ArchitecturalCanvasApp.tsx` |
| Portable card “DNA” (grid, fields, typography) | `src/components/foundation/lore-entity-card.module.css` | Canvas-only hacks inside the card CSS when they should be viewport-specific |
| Canvas chrome (selection, max-height, **canvas-only hiding** of sections) | `src/components/foundation/ArchitecturalCanvasApp.module.css` | Hiding focus content here — use focus overlay classes |
| Canvas-specific React shell (tape, width, body host) | `src/components/foundation/Architectural*CanvasNode.tsx` (one component per variant) | Inlining huge JSX branches inside `ArchitecturalCanvasApp.tsx` |
| Focus-only draft split / merge | `src/lib/*-focus-html.ts` (pure functions + `DOMParser`) | Ad-hoc string split in the shell that drifts from seed HTML |
| “Is this entity our variant?” | **One** exported helper per family, e.g. `shouldRenderLoreCharacterCredentialCanvasNode` | Repeated `entity.theme === … && html.includes(…)` across files |

---

## 2. Detection: one helper, used everywhere

Export a single predicate (plus optional `bodyHtmlImplies…` for legacy HTML):

- Inputs: at least `kind`, `bodyHtml`, and `loreCard` from `CanvasContentEntity`.
- Call sites: canvas rendering, focus **surface** resolution, palette creation, undo/focus restore, labs.

Then drive UI from a **small enum** (e.g. `focusSurface`: `default-doc` | `code` | `character-hybrid` | …) instead of combining multiple booleans (`focusCodeTheme && !focusLore…`). New surfaces extend the enum and the resolver in **one place**.

---

## 3. Stable selectors: `data-hg-*` first

CSS Modules hash class names (`charSkFoo` becomes `lore_entity_card_charSkFoo__xYz`). That is fine for **styling**, but brittle for:

- `querySelector` / `DOMParser` in focus merge logic
- “Does saved HTML look like v11?” checks

**Best practice**

- Add **stable `data-hg-*` attributes** on structural nodes when you need programmatic identity (portrait root, a notes body, a section to split on focus). Keep them **semantic and versioned** where needed (`data-hg-lore-portrait-root="v11"`).
- If you must match a class substring, prefer `[class*="charSkNotesBody"]` **only** when you cannot add data attributes to older stored HTML — document the assumption.

---

## 4. Canvas vs focus (progressive disclosure)

Decide explicitly for each region of the template:

| Region | Typical canvas | Typical focus |
|--------|----------------|---------------|
| Identity / metadata / portrait | Shown, compact | Shown, may mirror or expand |
| Long-form narrative / “document” | **Optional: hidden** on canvas (CSS under canvas root) | Full editor, second column, or merged body |

**Pattern used for character v11:** body HTML still contains the full grid (including notes) for **persistence**; the **canvas** root (e.g. `.loreCharacterCanvasRoot`) hides the notes row with CSS so the card stays scannable. **Focus** uses the **same global** `focusSheet` + **one** `BufferedContentEditable` (`focusBody`) as default document focus; `.focusCharacterDocument` softens v11 “card” chrome so it reads as a **single scrollable document** (metadata + notes in one flow).

Avoid removing nodes from `bodyHtml` only on canvas in JS — you’ll fight sync and undo. Prefer **display:none** under a **canvas-only** wrapper class or `data-hg-canvas-role`.

---

## 5. Focus: same interaction shell for every surface

**Intent:** Custom card bodies on the canvas can diverge, but **focus** should feel like the **same full-screen document editor** (`focusOverlay` → `focusSheet` → header + body + dock): one continuous region where possible, same formatting affordances as default notes.

- **Resolver:** Map `(focusOpen, activeEntity)` → `focusSurface` (e.g. `character-hybrid`). Branch for dark scrim, **hidden title** (when title comes from elsewhere), and **body classNames** — not for mounting a second parallel editor tree unless truly necessary.
- **One `focusBody` host:** Prefer a **single** `BufferedContentEditable` + `setFocusBody` / save path. Use CSS (e.g. `.focusCharacterDocument`) to de-emphasize canvas-oriented chrome (badges, lanyards, heavy card shadows) in focus — not a second stacked “card UI.”
- **Slash / block insert on v11 HTML:** Nested `contenteditable` fields (name, meta) vs notes body — scope **rich insert** to the notes region via `isRichDocBodyFormattingTarget` (e.g. caret inside `[class*="charSkNotesBody"]`).

---

## 6. Undo / history and focus

When graph state is restored while focus is open, **`focusBody` / baselines** already track `restored.bodyHtml` — no separate “slice” state unless you intentionally split the model.

---

## 7. Labs and regression

- Exercise new variants in **`/dev/lore-entity-nodes`** (or the dedicated lab component) with the **same** body host classes as production where possible.
- Run **`npm run check`** before merge; add Storybook only when a story materially reduces regression risk.

---

## 8. Checklist — new lore/canvas node type

1. [ ] **Predicate + optional `bodyHtmlImplies…`** in `lore-node-seed-html` (or sibling module).
2. [ ] **Seed HTML** function; wire `getLoreNodeSeedBodyHtml` / creation paths.
3. [ ] **`Architectural…CanvasNode`** component + canvas root class + `data-hg-canvas-role` for debugging.
4. [ ] **Canvas-only CSS** under that root where the canvas must stay compact.
5. [ ] **Focus surface** in resolver; prefer **one** `focusBody` editor + document-style body class over split editors unless the data model truly requires it.
6. [ ] **`isRichDocBodyFormattingTarget`** (or equivalent) if nested editables need block/slash scoped to a prose region.
7. [ ] **Lab page** smoke path + `npm run check`.

---

## 9. Reference implementation

The **character v11** path:

- Detection: `shouldRenderLoreCharacterCredentialCanvasNode`, `bodyHtmlImpliesLoreCharacterV11`
- Canvas shell: `ArchitecturalLoreCharacterCanvasNode`, `.loreCharacterCanvasRoot` (notes row hidden on canvas for height)
- Focus: `focusSurface === "character-hybrid"`, **same** `BufferedContentEditable` as default doc, class **`focusCharacterDocument`**, readable header **`focusMetaReadable`**

Treat new types as parallel tracks with the same **seams**, not copy-paste of one-off fixes.
