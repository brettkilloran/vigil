# heartgarden — Visual revamp plan (wholesale polish)

**Note:** This doc predates the **architectural-only** shell. Names like `VigilCanvas`, `CanvasItemView`, `VigilMainToolbar`, `ScratchPad`, and `BacklinksPanel` refer to **removed or superseded** paths; the live UI is **`ArchitecturalCanvasApp`** and `src/components/foundation/*`. Treat §§ below as **historical intent + token guidance**, not a file map.

**Goal:** Move from “wireframe / programmer UI” to a cohesive, Spatial-inspired surface: readable hierarchy, soft contrast, depth, consistent radii, and chrome that reads as **buttons** and **panels**, not floating text.

**Benchmark:** `docs/HEARTGARDEN_MASTER_PLAN.md` → Visual Design Bible + Typography + Phase 6–7 tasks.

### Vercel spike (landed)

**Done:** Geist Sans + Geist Mono (UI / code), Lora for `.ProseMirror` H1/H2 only; layered neutral tokens (`--vigil-card-bg`, `--vigil-card-border`, `--vigil-card-header-bg`, `--vigil-folder-tab-bg`, warm `--vigil-canvas`); cards use tokens in `CanvasItemView`; Spatial-style whisper shadows + folder tab/sheen + optional folder tint; flat canvas surface; TipTap inset format bar + card header tokens.

**Wholesale revamp (in-scope) — done:** A–E from §8: tokens/cards, TipTap chrome + padding, **`VigilMainToolbar`** (Lucide + grouping), dot grid + resize handles + context menu icons, **`CommandPalette`** / **`ScratchPad`** / **`LinkGraphOverlay`** header parity, **`BacklinksPanel`** + **`EntityTypeBar`** + **`TimelinePanel`** padding and Lucide headers, shared **`HEARTGARDEN_CHROME_ICON`** / **`HEARTGARDEN_ICON_GHOST_BTN`**.

**Spatial reference (local bible):** Keep a copy of **`spatial_reference_bible.md`** (from the Spatial.app extraction) beside the repo or under `docs/` — it lists Swift modules, spring names, typography tokens, and icon inventory that map to **`docs/HEARTGARDEN_MASTER_PLAN.md` §4 (Visual Design Bible)**. heartgarden intentionally diverges where the web stack differs (e.g. Geist vs Eina, no Display P3 requirement), but **canvas field, folder tab + sheen, whisper shadows, and flat canvas** should track that document.

**Optional later (not blocking “done”):** Spring-tuned motion matching `spatial_reference_bible.md` §6; full type-scale audit; flower picker (§9); folder item counts when child-space items are queryable on canvas.

---

## 1. Diagnosis (why it feels “shocking” today)

| Symptom | Cause in code / tokens |
|--------|-------------------------|
| Stark white cards on near-black canvas | `CanvasItemView` sets note/checklist **`background: #fff`** while canvas uses `--vigil-canvas` (`#0c0d11` dark). No **card-surface** token tied to theme. |
| Flat / harsh chrome | Addressed: **`VigilMainToolbar`** + Lucide; legacy diagnosis referred to pre-refactor `VigilApp` toolbar. |
| TipTap bar looks pasted on | Addressed: Lucide icon buttons, group dividers, `HEARTGARDEN_EDITOR_TOOLBAR_ICON_BTN`, extra `.ProseMirror` padding—further “inset pill” polish optional. |
| Panels readable but cramped | Addressed: **`p-3`**, wider Links panel, **`HEARTGARDEN_METADATA_LABEL`** sections, focus rings on list rows; further type-scale audit optional. |
| Canvas feels empty / void | Addressed per **Spatial bible**: **flat warm/cool neutral field** — dot grid removed; calm empty canvas. |

---

## 2. Design system layer (do this first)

**2.1 New semantic tokens** in `app/globals.css` (light + dark + `data-vigil-theme` mirrors):

| Token | Role |
|-------|------|
| `--vigil-card-bg` | Note / checklist / default card fill ( **not** pure `#fff` in dark—use elevated cool gray, e.g. `~#1a1b22` dark / `~#fdfdfd` light). |
| `--vigil-card-border` | Softer than `--vigil-border` on cards (lower contrast edge). |
| `--vigil-card-header-bg` | Chrome strip under title (subtle tint). |
| `--vigil-canvas-dots` or SVG overlay | Optional pattern color at low opacity. |

**2.2 Radius scale** (single source of truth):

- Cards: `rounded-xl` or `rounded-2xl` (match panels).
- Inner editor: `rounded-b-*` aligned with card.
- Toolbar capsule: same family as `HEARTGARDEN_GLASS_PANEL`.

**2.3 Elevation** — extend `src/lib/card-shadows.ts`:

- Stronger **rest** shadow in dark mode so cards separate from canvas (your screenshots show separation failing).
- Keep selected / lift states; optionally add a **very subtle** inner highlight on top edge of cards (Spatial folder sheen pattern, scaled down for notes).

**2.4 Icon set**

- Add **`lucide-react`** (MIT, tree-shakeable). Use **16–18px** icons on toolbar, **14px** in dense editor bar.
- Do **not** mix 3 icon libraries.

---

## 3. Cards (highest user-visible impact)

**3.1 `CanvasItemView.tsx`**

- Replace hardcoded `#fff` with **`var(--vigil-card-bg)`** (and stickies keep saturated `item.color` with tuned border).
- Title chrome row: increase height slightly (`h-9` / `h-10`), use `--vigil-card-header-bg`, **truncate + optional type icon** per `itemType`.
- Ensure **border** uses `--vigil-card-border`; selection ring can stay snap-colored but soften non-selected edges.

**3.2 Per-type pass**

- **Note / checklist** (`NoteCard.tsx`): increase **padding** in editor area; TipTap toolbar as **pill or inset bar** (see §4).
- **Folder** — already has gradient; align border/radius with new tokens.
- **Image / webclip** — rounded inner content to match card radius; metadata strip later (Phase 7).

**3.3 Resize handles**

- `ResizeHandles.tsx`: slightly larger hit targets, snap-colored fill with **semi-transparent** track so they don’t read as “debug UI”.

---

## 4. TipTap / note editor chrome

**File:** `NoteCard.tsx` (`NoteFormatToolbar`)

- Replace raw `B` / `I` with **Lucide** (`Bold`, `Italic`, etc.) + `aria-label` + tooltip titles (keep mod key hints).
- Toolbar container: **rounded** inner container, `backdrop-blur` or solid `--vigil-elevated`, **vertical rhythm** (`gap-1`, `py-2`).
- Optional: **divider** components between groups (marks, lists, headings).
- Wiki link / code buttons: icons + consistent pressed state (`HEARTGARDEN_EDITOR_TOOLBAR_BTN_ON` refined).

**globals.css** `.ProseMirror`:

- Slightly increase **padding** inside the scroll area for dark mode readability.

---

## 5. Main toolbar & floating chrome

**File:** `app/_components/VigilApp.tsx` (toolbar block using `HEARTGARDEN_GLASS_PANEL`)

- **Group** actions: Create (Note, Sticky, Folder) | Data (Export, Import) | Panels (Scratch, Search, Timeline, Graph) | Settings row (snap, theme, space).
- Use **horizontal dividers** (`border-t` + `gap`) or nested glass **sub-panels**.
- Every action: **icon + short label** (label can wrap under icon on narrow width, or icon-only with `title` on xs).
- **Minimum tap targets** ~36px height for primary actions.

**Shared classes:** evolve `src/lib/vigil-ui-classes.ts`:

- `HEARTGARDEN_TOOLBAR_ICON_BTN` — square-ish, icon-centered, hover ring.
- Keep `HEARTGARDEN_CHIP_BTN` for secondary text actions or demote to “compact chip” variant.

**Also revamp:** `ContextMenu.tsx`, `CommandPalette.tsx`, `ScratchPad`, `LinkGraphOverlay` — **done** (Lucide + spacing + focus rings where needed).

---

## 6. Canvas background

**File:** `VigilCanvas.tsx` + `app/globals.css` (`.vigil-canvas-surface`)

- **Spatial-aligned:** flat **`--vigil-canvas`** only (warm light ~`#eae8ea`, dark charcoal ~`#1e1e22`). No dot texture — matches master plan “emptiness IS the design.”

---

## 7. Side panels (Links, TTRPG, Timeline)

- **Landed:** `p-3`, Links `max-w` 300px, section titles via `HEARTGARDEN_METADATA_LABEL`, list-row / meta **focus rings**; timeline uses ghost dismiss like scratch.

---

## 8. Execution order (recommended sprints)

| Sprint | Scope | Outcome |
|--------|--------|---------|
| **A** | Tokens + `CanvasItemView` card surfaces + shadows | Cards stop looking like pasted white boxes in dark mode. |
| **B** | TipTap toolbar + NoteCard padding | Editor feels intentional. |
| **C** | Lucide + VigilApp toolbar regroup | “Menus” read as a real app shell. |
| **D** | Canvas dot grid + resize handles + context menu | Spatial scale + less debuggy handles. |
| **E** | Command palette, graph modal, scratch — visual parity | One design language end-to-end. |

After **A–C**, take **screenshots** (light/dark, empty + populated) and compare to master plan references.

---

## 9. Non-goals (this pass)

- **Flower color picker** (user-facing theme / card chrome) — separate milestone (high effort). *Boot **`VigilBootFlowerGarden`** is decorative only; not this picker.*
- **Fullscreen note transition** — can follow once card language is stable.
- **LLM / data** features — out of scope for visuals-only work.

---

## 10. Success criteria

- Dark mode: **no pure `#fff`** full-card fills unless user explicitly chose a light sticky color.
- Toolbar: **icons + grouping**; no row of ambiguous text-only controls as the primary shell.
- Cards: visible **depth** at rest; selection state obvious but not clinical.
- TipTap bar: looks like part of the **card**, not a debug strip.
- All changes **theme-toggle safe** (`data-vigil-theme` + system).

---

*This document is the execution roadmap; keep `docs/STRATEGY.md` in sync with high-level status when major slices land.*
