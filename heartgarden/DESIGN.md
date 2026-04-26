---
name: heartgarden
description: >
  A dark spatial-canvas lore tool. Light cards float on a near-black field.
  Glass chrome, whisper shadows, and a single warm amber accent keep the
  surface calm and focused. AI-generated content uses a distinct deep purple
  accent. The emptiness of the canvas is intentional — it communicates
  possibility, not incompleteness.

colors:
  # Canvas / shell
  canvas: "oklch(0.145 0 0)"           # #1a1a1a — near-black base field
  surface-elevated: "oklch(0.205 0 0)" # #282828 — glass panels / drawers
  surface-card: "oklch(0.967 0 0)"     # #f5f5f5 — floating card fill (light on dark)
  surface-code-card: "oklch(0.188 0 0)" # #252525 — code-node dark card
  # Text
  text-primary: "oklch(0.967 0 0)"     # #f5f5f5 — on dark shell
  text-secondary: "oklch(0.868 0 0)"   # #d4d4d4
  text-muted: "oklch(0.62 0 0)"        # #939393
  text-on-card: "oklch(0.23 0 0)"      # #2e2e2e — primary text on light cards
  text-on-accent: "oklch(0.145 0 0)"   # #1a1a1a — text on amber buttons
  # Brand accents
  accent: "oklch(0.74 0.31 50)"        # vivid warm amber/orange — selection ring, snap, primary CTA
  accent-llm: "oklch(0.30 0.22 294)"   # deep saturated purple — AI-generated content only
  accent-llm-bright: "oklch(0.80 0.13 294)" # lighter purple — readable AI labels
  # Feedback
  danger: "oklch(0.577 0.245 27.33)"   # red-orange — destructive actions
  danger-readable: "oklch(0.793 0.133 17.7)" # lighter red — danger text on dark
  # Borders
  border-subtle: "oklch(1 0 0 / 0.06)" # white 6% — glass edges on dark shell
  border-strong: "oklch(1 0 0 / 0.10)" # white 10% — stronger chrome edges
  border-card: "oklch(0.868 0 0)"      # neutral-300 — card perimeter on light bg
  # Code syntax (OKLCH, dark-card context)
  syntax-keyword: "oklch(0.63 0.18 320)"  # pink-magenta
  syntax-name: "oklch(0.81 0.12 85)"      # warm yellow
  syntax-property: "oklch(0.74 0.12 55)"  # amber-gold
  syntax-string: "oklch(0.77 0.15 145)"   # green
  syntax-comment: "oklch(0.47 0.02 264)"  # cool muted blue-gray

typography:
  ui:
    fontFamily: "Geist Sans"
    fallback: "system-ui, sans-serif"
    smoothing: antialiased
  prose-heading:
    fontFamily: "Lora"
    fallback: "ui-serif, Georgia, serif"
    note: "Serif only at H1/H2 in rich-text editor nodes — adds gravitas without heaviness"
  mono:
    fontFamily: "Geist Mono"
    fallback: "ui-monospace, monospace"
  scale:
    h1: { family: Lora, size: "2.125rem", weight: 400, tracking: "-0.015em", lineHeight: 1.28 }
    h2: { family: Lora, size: "1.5rem",   weight: 400, tracking: "-0.01em",  lineHeight: 1.32 }
    h3: { family: "Geist Sans", size: "1.125rem", weight: 600, lineHeight: 1.38 }
    body: { size: "16px", weight: 400, lineHeight: 1.65 }
    button: { size: "0.75rem", weight: 500, tracking: "0.03em", lineHeight: 1 }
    tooltip: { size: "12px", tracking: "0.01em", lineHeight: 1.45 }
    code-inline: { size: "0.9em" }
    code-block: { size: "0.82rem" }

spacing:
  base: 4px
  xs: 8px
  sm: 10px
  md: 12px
  lg: 16px
  xl: 24px
  note: "4px base unit. Control padding uses sys-control-pad-x-* tokens."

rounded:
  sm: 4px
  md: 8px
  lg: 12px
  panel: 10px
  card: 16px   # Tailwind rounded-2xl target for canvas nodes
  full: 999px

controls:
  height-xs: 28px
  height-sm: 32px
  height-md: 36px
  height-lg: 40px
  pad-x-xs: 8px
  pad-x-sm: 10px
  pad-x-md: 12px
  pad-x-lg: 16px
  min-tap-target: 36px

elevation:
  sm:  "0 1px 2px oklch(0 0 0 / 0.30)"
  md:  "0 4px 12px oklch(0 0 0 / 0.20)"
  lg:  "0 8px 32px oklch(0 0 0 / 0.40)"
  xl:  "0 20px 40px oklch(0 0 0 / 0.40)"
  chrome-glass: "0 8px 32px oklch(0 0 0 / 0.40)"
  note: "Cards use md shadow at rest. Selection/hover upgrades to lg. No shadow on flat canvas."

motion:
  duration-fast: 150ms
  duration-normal: 220ms
  easing-standard: "cubic-bezier(0.2, 0, 0, 1)"
  note: "All interactive state transitions (bg, color, border, transform) use fast + standard."

glass:
  filter: "blur(16px) saturate(135%)"
  bg: "oklch(0.176 0 0 / 0.70)"
  border: "oklch(1 0 0 / 0.06)"
  note: "Applied to toolbars, floating panels, and tooltips. Never to content cards."

icons:
  library: lucide-react
  size-toolbar: 16–18px
  size-editor-bar: 14px
  note: "Single icon library. No mixing."
---

# heartgarden — Visual Design Essence

## Overview

heartgarden is a **spatial lore canvas** — a tool for building and exploring fictional worlds. The visual language is directly inspired by spatial computing UIs: a calm near-black field, white cards floating at different elevations, glass-chrome tool surfaces, and a single warm amber accent for all active/selected states.

The core principle is **restraint**. The canvas is dark and empty on purpose. Cards are the protagonists — light surfaces on a dark field, giving each node visual weight and presence. Chrome elements (toolbar, panels, tooltips) are frosted glass, visually subordinate to the content.

AI-generated content uses a **distinct deep purple accent** (`oklch(0.30 0.22 294)`) — never amber — so the user always knows what the machine contributed.

## Colors

### The Palette in Practice

**Shell and canvas**: Everything outside a card is dark. The canvas base is `oklch(0.145 0 0)` — a near-neutral dark slightly cooler than pure black, giving depth without harshness.

**Cards**: Cards are near-white (`oklch(0.967 0 0)`) with dark text (`oklch(0.23 0 0)`) — the highest contrast pairing. This is the deliberate "spatial" move: light objects floating in a dark space. There is no light-mode canvas.

**The single accent**: Warm amber (`oklch(0.74 0.31 50)`) is the only chromatic color used for brand UI: selection rings, snap handles, primary CTA buttons, blockquote left-borders. Do not introduce secondary brand hues.

**LLM purple**: Deep saturated purple (`oklch(0.30 0.22 294)`) marks AI-generated, pending, or agent-attributed content. It never appears in navigation, structural chrome, or decorative contexts — only where the distinction "human vs machine" matters.

**Code-card syntax**: Code node cards use a dark card surface (`oklch(0.188 0 0)`) and a five-hue syntax palette centered on warm yellows, greens, and pink-magenta. Contrast ratio targets AAA against that card surface.

### Do's and Don'ts

- **Do** keep all shell chrome in the dark neutral family; **do not** use tinted panels.
- **Do** use the amber accent for focus rings, active selection, and one primary action per context.
- **Do not** use amber for informational or decorative decoration — only for affordances.
- **Do not** mix the LLM purple accent with any navigation or shell element.
- **Do not** use pure `#fff` on full card fills without a deliberate sticky-note color intent — use `oklch(0.967 0 0)` (neutral warm white) instead.

## Typography

### Font Stack

- **UI body and chrome**: Geist Sans — geometric, neutral, legible at small sizes. Mirrors the Vercel aesthetic heartgarden intentionally echoes.
- **Prose headings (H1, H2 only)**: Lora — a serif that adds editorial gravitas inside rich-text editor nodes. Used sparingly; H3 and below revert to Geist Sans.
- **Code**: Geist Mono — consistent with the UI family.

### Scale Philosophy

The type scale is **conservative and functional**. No decorative display sizing. Body text at 16px / 1.65 line-height is optimized for reading dense lore content. Buttons sit at 12px / 500 weight with wide tracking (0.03em) to read clearly at control height. Serif headings use weight 400 (not bold) so they read as editorial rather than structural.

### Anti-patterns

- **Do not** use Lora outside H1/H2 in prose editor contexts.
- **Do not** mix a third font family.
- **Do not** letter-space body text — only button labels and tooltip text.

## Layout & Spacing

The base unit is **4px**. Most spacing values are multiples of 4. The control height scale (28 / 32 / 36 / 40px) defines tap-target discipline — do not place interactive elements below 28px height, and prefer 36px for primary toolbar actions.

Canvas layout is **freeform** — nodes are positioned arbitrarily on an infinite field. Panel layouts use the standard Tailwind gap/padding scale on the 4px base.

## Elevation & Depth

Elevation is used only on **cards** and **glass chrome**. The flat canvas surface has no shadow. Cards at rest use `md` shadow (`0 4px 12px black/20%`). Selected or hovering cards upgrade to `lg`. Never invent ad-hoc shadow values — always use the `--sem-shadow-*` token scale.

Glass panels (toolbar, floating UI) use a dedicated chrome shadow (`0 8px 32px black/40%`) with `blur(16px) saturate(135%)` backdrop filter. This creates the "frosted glass over canvas" layering effect.

Card depth cue: a faint top-edge inner highlight (`1px solid white/5%`) can be used optionally to mimic Spatial.app's folder sheen pattern on dark-variant cards.

## Shapes

The radius scale is strict:

- **4px (sm)**: Checkboxes, focus-ring insets, inline chips
- **8px (md)**: Buttons, tooltips, input fields
- **10px (panel)**: Floating glass panels and toolbars
- **12px (lg)**: Tags, context menu containers
- **16px (card)**: Canvas node cards — rounded-2xl Tailwind
- **999px (full)**: Pill shapes, badge indicators

Do not use free-form radius values. All corner radii must map to one of the six stops above.

## Components

### Buttons

Four variants: **primary** (light fill, dark text), **neutral** (5% white fill, primary text), **ghost** (transparent, muted text upgrades on hover), **danger** (semi-transparent red fill with danger text). A specialized **card-tone** variant (light and dark flavors) handles icon-only actions inside card headers without disrupting the card's visual quiet.

All buttons share: 36px default height, Geist Sans 12px/500, 8px radius, 150ms transitions.

Focus visible: amber focus ring at 2px width, 2px offset.

### Cards (Canvas Nodes)

Cards are the primary content atoms. They float on the canvas with:
- Near-white fill (`--theme-*-bg`)
- Subtle border (`--theme-*-border`)
- Card header chrome: very slight dark tint (`oklch(0 0 0 / 0.04)`) for the title row
- `md` shadow at rest, upgrades on selection
- `rounded-2xl` (16px) corners
- Node type variants: default/note (white), task/checklist (white), code (dark), media/image (dark), folder (dark with gradient tab)

### Glass Chrome (Toolbar / Panels)

All floating UI uses the glass recipe: `70%` opacity dark background + `blur(16px) saturate(135%)` + `border: 1px solid white/6%`. This creates a frosted dark panel that reads as shell, not content. Never apply glass recipe to content cards.

### Tooltips

Inherit glass recipe. Max-width 300px. 12px text. 8px radius. 10px/7px x/y padding. Appear with 150ms ease (standard easing). Shadow matches chrome glass.

## Do's and Don'ts

**Do:**
- Keep the canvas flat and dark — the emptiness is a design decision, not a placeholder.
- Float light cards on the dark field; never invert this (no dark cards on a light canvas).
- Use one accent color (amber) per interactive affordance category.
- Run glass blur on toolbar/panel chrome, not on content.
- Use Lora only for H1/H2 inside rich-text prose — never in UI chrome.
- Scale icon sizes to context: 16–18px toolbar, 14px dense editor bar.
- Use `--sem-shadow-*` tokens — never ad-hoc box-shadow values.
- Keep motion at 150ms for state transitions; 220ms for larger layout animations.

**Don't:**
- Use purple for anything other than AI/LLM-attributed content.
- Add a third font family.
- Use pure `#000` or `#fff` directly — always reference the OKLCH token palette.
- Mix icon libraries.
- Add tinted panel backgrounds — the shell is strictly neutral.
- Use `opacity` hacks for button variants — use tone tokens (`focus-light`, `card-dark`, etc.).
- Introduce decorative gradients on shell elements (only folder cards may have gradient tabs).
