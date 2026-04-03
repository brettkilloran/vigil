# VIGIL — Visual revamp plan (wholesale polish)

**Goal:** Move from “wireframe / programmer UI” to a cohesive, Spatial-inspired surface: readable hierarchy, soft contrast, depth, consistent radii, and chrome that reads as **buttons** and **panels**, not floating text.

**Benchmark:** `docs/VIGIL_MASTER_PLAN.md` → Visual Design Bible + Typography + Phase 6–7 tasks.

---

## 1. Diagnosis (why it feels “shocking” today)

| Symptom | Cause in code / tokens |
|--------|-------------------------|
| Stark white cards on near-black canvas | `CanvasItemView` sets note/checklist **`background: #fff`** while canvas uses `--vigil-canvas` (`#0c0d11` dark). No **card-surface** token tied to theme. |
| Flat / harsh chrome | Toolbar uses text-only **`VIGIL_CHIP_BTN`** rows in `VigilApp.tsx`; little grouping, no icons, tight wrapping. |
| TipTap bar looks pasted on | `NoteFormatToolbar` in `NoteCard.tsx` uses small letter labels on a thin bordered strip—no iconography, weak separation from body. |
| Panels readable but cramped | `BacklinksPanel`, `EntityTypeBar`, etc. use glass classes but **padding / type scale** could step up one notch for dark backgrounds. |
| Canvas feels empty / void | Solid fill only; optional **dot grid** or very subtle noise improves scale (plan allows this). |

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
- Toolbar capsule: same family as `VIGIL_GLASS_PANEL`.

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
- Wiki link / code buttons: icons + consistent pressed state (`VIGIL_EDITOR_TOOLBAR_BTN_ON` refined).

**globals.css** `.ProseMirror`:

- Slightly increase **padding** inside the scroll area for dark mode readability.

---

## 5. Main toolbar & floating chrome

**File:** `app/_components/VigilApp.tsx` (toolbar block using `VIGIL_GLASS_PANEL`)

- **Group** actions: Create (Note, Sticky, Folder) | Data (Export, Import) | Panels (Scratch, Search, Timeline, Graph) | Settings row (snap, theme, space).
- Use **horizontal dividers** (`border-t` + `gap`) or nested glass **sub-panels**.
- Every action: **icon + short label** (label can wrap under icon on narrow width, or icon-only with `title` on xs).
- **Minimum tap targets** ~36px height for primary actions.

**Shared classes:** evolve `src/lib/vigil-ui-classes.ts`:

- `VIGIL_TOOLBAR_ICON_BTN` — square-ish, icon-centered, hover ring.
- Keep `VIGIL_CHIP_BTN` for secondary text actions or demote to “compact chip” variant.

**Also revamp:** `ContextMenu.tsx`, `CommandPalette.tsx`, `ScratchPad`, `LinkGraphOverlay` header — same icon language and spacing.

---

## 6. Canvas background

**File:** `VigilCanvas.tsx`

- Layer under transform: **optional** CSS `background-image` radial dots (use `color-mix` with `--vigil-canvas` so it works in light/dark).
- Keep performance: **no** animated grid; static pattern only.

---

## 7. Side panels (Links, TTRPG, Timeline)

- Already on glass; bump **padding** (`p-3`), **max-width** where needed, **section titles** with `VIGIL_METADATA_LABEL` / semibold mix.
- Ensure **focus rings** visible on dark glass.

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

- **Flower color picker** — separate milestone (high effort).
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
