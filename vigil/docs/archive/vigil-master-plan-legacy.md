# heartgarden — Master Build Plan

> **What this document is:** A fully self-contained plan for building heartgarden, an infinite canvas knowledge tool inspired by the macOS app Spatial. This document contains EVERY detail needed to build the app from scratch — architecture, visual design specs, animation parameters, typography, interaction patterns, and phased implementation. It was compiled by reverse-engineering the Spatial.app binary, extracting its App Store screenshots, and analyzing its design philosophy.
>
> **What heartgarden is:** A personal-use infinite canvas web app for organizing notes, images, stickies, checklists, web clips, and folders on a free-form spatial surface. Optimized for two use cases: (1) general knowledge management/work productivity and (2) TTRPG worldbuilding with cross-linked lore, semantic search, and LLM integration.
>
> **Single user, no auth.** This is a personal tool. No login, no OAuth, no user management. One person, one database.
>
> **$0 recurring cost.** Everything runs on free tiers (Vercel Hobby, Neon Free, Cloudflare R2 Free). Every library is MIT-licensed. No vendor lock-in.

> **Implementation note:** The **shipping canvas shell** is **`ArchitecturalCanvasApp`** in `src/components/foundation/`, not the historical `VigilCanvas` / `components/canvas/` file tree shown under Phase 1 below. Phases and behavior still apply; paths are legacy names. **Living execution status:** `docs/BUILD_PLAN.md`.

---

## Table of Contents

1. [Stack & Architecture](#stack--architecture)
2. [Data Model](#data-model)
3. [Custom Canvas Engine](#custom-canvas-engine)
4. [Visual Design Bible](#visual-design-bible) ← **THE BIG ONE. Read this carefully.**
5. [Typography System](#typography-system)
6. [Animation & Spring Physics](#animation--spring-physics)
7. [Interaction Patterns](#interaction-patterns)
8. [Content Types](#content-types)
9. [UI Components](#ui-components)
10. [Search Architecture](#search-architecture)
11. [LLM / MCP Integration](#llm--mcp-integration)
12. [TTRPG Worldbuilding](#ttrpg-worldbuilding)
13. [Phase Breakdown](#phase-breakdown)
14. [Reference Screenshots](#reference-screenshots)

---

## Stack & Architecture

```
heartgarden (client)
├── Next.js 15 App Router + React 19
├── Custom Canvas Engine (CSS transforms, no <canvas> element)
│   ├── @use-gesture/react   (MIT) — unified pointer/touch/wheel gestures
│   ├── framer-motion         (MIT) — spring physics for all animations
│   └── zustand + immer       (MIT) — state management
├── TipTap                    (MIT) — ProseMirror-based rich text editor
├── Tailwind CSS 4            (MIT) — utility-first styling
└── TypeScript strict mode

heartgarden (server)
├── Next.js API Routes (REST)
├── Drizzle ORM               (MIT) — type-safe SQL
├── Neon PostgreSQL            (free tier, 0.5GB)
│   ├── pgvector extension     — semantic search embeddings
│   └── tsvector + GIN index   — full-text search
├── Cloudflare R2              (free tier, 10GB) — image/file storage
└── OpenAI API                 — text-embedding-3-small (pennies/month)
```

**Why NO tldraw / NO third-party canvas SDK:**

tldraw SDK 4.0 requires a $6,000/year commercial license. Its free hobby tier has a watermark and prohibits commercial use. Beyond cost, tldraw is a whiteboard SDK — it ships drawing tools, erasers, shape connectors, multiplayer sync, its own serialization format, and an opinionated UI layer. We'd be paying for a library and then overriding 80% of it.

Spatial is not a whiteboard. It's **positioned HTML cards on a pannable surface**. That's a fundamentally simpler rendering model — a React component tree with CSS `transform: translate() scale()`. We build exactly what we need, control every pixel, and own the interaction feel completely.

**Why NO auth:**

Single user, single device. The app runs on Vercel pointing at one Neon database. No multi-tenancy, no login page, no OAuth dance, no session management. This removes an entire layer of complexity and several third-party dependencies (Auth.js, Google Cloud Console setup, etc.). If multi-user is ever needed later, it can be added — but for now, simplicity wins.

---

## Data Model

Items are the universal unit. A TTRPG "Character" is just a Note with `entity_type = 'character'` and structured metadata. The canvas system and the worldbuilding system share the same data layer.

```sql
-- No users table. Single user. No auth.

CREATE TABLE spaces (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_space_id UUID REFERENCES spaces(id) ON DELETE SET NULL,  -- for nested folders
  name          TEXT NOT NULL,
  color         TEXT,  -- hex color string
  canvas_state  JSONB DEFAULT '{"x": 0, "y": 0, "zoom": 1}',  -- camera position
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id      UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  item_type     TEXT NOT NULL,  -- 'note' | 'image' | 'sticky' | 'checklist' | 'webclip' | 'folder'
  x             DOUBLE PRECISION NOT NULL DEFAULT 0,
  y             DOUBLE PRECISION NOT NULL DEFAULT 0,
  width         DOUBLE PRECISION NOT NULL DEFAULT 280,
  height        DOUBLE PRECISION NOT NULL DEFAULT 200,
  z_index       INTEGER DEFAULT 0,
  title         TEXT,
  content_text  TEXT,  -- plain text for FTS (auto-derived from content_json)
  content_json  JSONB,  -- TipTap JSON for rich text
  image_url     TEXT,  -- R2 URL
  image_meta    JSONB,  -- { width, height, palette: string[], filename, date }
  color         TEXT,  -- hex color for stickies/folders
  -- TTRPG fields (nullable, used from Phase 5)
  entity_type   TEXT,  -- 'character' | 'location' | 'faction' | 'event' | 'item' | 'lore'
  entity_meta   JSONB,  -- structured fields per entity type
  -- Stack/group membership
  stack_id      UUID,  -- if this item belongs to a stack group
  stack_order   INTEGER,
  -- Full-text search
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content_text, ''))
  ) STORED,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX items_search_idx ON items USING GIN (search_vector);
CREATE INDEX items_space_idx ON items (space_id);

CREATE TABLE item_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_item_id  UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  target_item_id  UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  link_type       TEXT DEFAULT 'reference',  -- 'reference' | 'parent' | 'related' | 'contradicts'
  label           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_item_id, target_item_id)
);

CREATE TABLE item_embeddings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  embedding   VECTOR(1536),  -- OpenAI text-embedding-3-small
  chunk_text  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX embeddings_idx ON item_embeddings USING ivfflat (embedding vector_cosine_ops);
```

Key design choices:
- `content_text` is auto-generated for search. `content_json` is the source of truth for rich text.
- `item_links` enables bidirectional cross-references between any two items.
- `entity_type` + `entity_meta` are nullable — a note becomes a Character by setting these fields. No migration needed.
- `canvas_state` on spaces stores only camera position `{x, y, zoom}`. Item positions live in the items table.
- `stack_id` + `stack_order` handle Spatial-style stacking without a separate table.

---

## Custom Canvas Engine

### Architecture

The canvas is NOT a `<canvas>` element. It's nested `<div>`s with CSS transforms. Items are real React components.

```
div.viewport              overflow: hidden; width: 100vw; height: 100vh
  div.transform-layer     transform: translate(camX px, camY px) scale(zoom)
    div.item-layer         position: relative (items positioned absolutely within)
      <NoteCard style="position:absolute; left:X; top:Y; width:W; height:H" />
      <StickyCard ... />
      <ImageCard ... />
      <FolderCard ... />
      <ChecklistCard ... />
    svg.guides-layer       snap guide lines (SVG, positioned absolutely)
    div.selection-lasso    lasso rectangle during box-select
  div.ui-overlay           position: fixed; pointer-events: none (children get pointer-events: auto)
    <Toolbar />            bottom center, dark floating pill
    <SpaceNav />           bottom right, space index + navigation
    <SettingsButton />     bottom left, sliders icon
    <CommandPalette />     centered, appears on Cmd+K
    <ContextMenu />        appears at right-click position
```

Why DOM-based:
- Native text rendering (no blurry canvas text)
- CSS transitions/hover/focus work naturally
- Accessibility (screen readers, keyboard focus)
- TipTap editor, checkboxes, form inputs work inside items
- Browser DevTools can inspect any element

### Zustand Store Shape

```typescript
interface CanvasStore {
  // Camera
  camera: { x: number; y: number; zoom: number };

  // Items (source of truth, synced to/from Neon)
  items: Map<string, CanvasItem>;

  // Selection
  selectedIds: Set<string>;

  // Undo/Redo (action-based, not snapshot-based)
  undoStack: UndoAction[];
  redoStack: UndoAction[];

  // Transient interaction state (not persisted)
  dragging: { itemId: string; startX: number; startY: number } | null;
  resizing: { itemId: string; handle: HandlePosition; startRect: Rect } | null;
  lasso: { x1: number; y1: number; x2: number; y2: number } | null;

  // Active space
  activeSpaceId: string;

  // Actions
  panCamera: (dx: number, dy: number) => void;
  zoomCamera: (delta: number, focalPoint: { x: number; y: number }) => void;
  moveItem: (id: string, x: number, y: number) => void;
  resizeItem: (id: string, w: number, h: number) => void;
  selectItem: (id: string, additive?: boolean) => void;
  deselectAll: () => void;
  createItem: (type: ItemType, x: number, y: number) => void;
  deleteItems: (ids: string[]) => void;
  undo: () => void;
  redo: () => void;
}
```

### Gesture Map (@use-gesture/react)

| Gesture | Target | Action |
|---------|--------|--------|
| Drag on empty space | Viewport | Pan camera |
| Drag on item | CanvasItem | Move item (spring settle on release) |
| Pinch / Ctrl+Wheel | Viewport | Zoom toward cursor |
| Scroll wheel | Viewport | Pan vertically/horizontally |
| Click item | CanvasItem | Select (clear others unless Shift) |
| Click empty space | Viewport | Deselect all |
| Drag empty + no modifier | Viewport | Box/lasso selection |
| Right-click | Any | Context menu |
| Double-click Note | NoteCard | Open editor (animated expand) |
| Double-click Folder | FolderCard | Navigate into child Space (zoom transition) |
| Double-click Image | ImageCard | Open expanded detail view |

### Coordinate Conversion

Screen coordinates → canvas coordinates:
```
canvasX = (screenX - camera.x) / camera.zoom
canvasY = (screenY - camera.y) / camera.zoom
```

Zoom toward cursor (keeps the point under the cursor fixed):
```
newZoom = clamp(oldZoom * (1 + delta), MIN_ZOOM, MAX_ZOOM)
camera.x = focalX - (focalX - camera.x) * (newZoom / oldZoom)
camera.y = focalY - (focalY - camera.y) * (newZoom / oldZoom)
```

### Selection System

- Click item → select (blue ring indicator, ~2px solid blue border)
- Shift+click → toggle in/out of selection
- Drag on empty → lasso rectangle (thin blue border, light blue fill at ~10% opacity)
- Items whose bounding box intersects the lasso get selected
- Selected items show 8 resize handles (4 corners + 4 edges)
- Multi-select shows a combined bounding box with resize handles

### Resize Handles

8 handles matching Spatial's `CanvasCornerResizeHandle` + `CanvasEdgeResizeHandle`:
- 4 corner handles: small squares (~8px), cursor: nwse-resize / nesw-resize
- 4 edge handles: small rectangles (~6×16px), cursor: ew-resize / ns-resize
- Hold Shift during corner resize → maintain aspect ratio
- Snap to other item edges during resize (see Snap Guides)

### Snap Guides

During drag or resize, calculate alignment with all other items:
- Compare: left edge, right edge, center X, top edge, bottom edge, center Y
- Threshold: ~5px in screen space (adjust for zoom level)
- When aligned: snap position to exact alignment, show thin line (#0066FF, 1px) spanning between the two items
- Multiple snap lines can appear simultaneously (e.g., snapped X + snapped Y)

### Undo/Redo

Action-based (not state snapshots — more memory efficient):
- Every mutation records `{ type, do(), undo() }`
- Cmd+Z → pop from undoStack, call undo(), push to redoStack
- Cmd+Shift+Z → pop from redoStack, call do(), push to undoStack
- Supported operations (matching Spatial's 13 undo types): Moving, Resizing, Creating Items, Deleting Items, Color Change, Stacking, Unstacking, Drop Items into Folder, Eject Items from Folder, Create Folder, Animating Item

---

## Visual Design Bible

**THIS IS THE MOST IMPORTANT SECTION.** The goal is to replicate Spatial's visual quality. Spatial was designed by a single Swedish designer (Tobias at 44X Design AB in Stockholm) with an obsessive eye for refinement. The app feels **distinct, elegant, and enjoyable** — those are his own design values. Every pixel matters.

### Canvas Surface

- **Background color (light mode):** A warm, very light gray. NOT pure white, NOT cool gray. It has a slight warm undertone. Approximate: `#EDEDEF` to `#E8E8EA`. Think of it as a very subtle warm concrete — almost white but with just enough gray to make white cards pop.
- **Background color (dark mode):** Deep charcoal, not pure black. Approximately `#1A1A1E` to `#202024`.
- **No grid dots, no lines, no texture.** The canvas is a perfectly flat, clean surface. Items float on it. The emptiness IS the design — it creates calm.
- **Display P3 wide gamut colors** are used throughout (not just sRGB). On the web, use `color(display-p3 ...)` CSS notation for vivid colors, falling back to hex for standard displays.

### Card / Item Appearance

All items (notes, stickies, images, checklists, web clips) share these baseline visual properties:

- **Background:** Pure white `#FFFFFF` (light mode). Very dark gray `#2A2A2E` (dark mode).
- **Corner radius:** Generous. Two modes the user can choose:
  - "Corners-soft" (default): ~14-16px radius. Feels friendly, modern, Apple-like.
  - "Corners-sharp": ~4-6px radius. Feels precise, technical, Bauhaus-like.
- **Shadows:** VERY subtle. This is critical — Spatial does NOT use heavy drop shadows. The shadow creates a whisper of elevation, not a bold statement. Think:
  - `box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)` (light mode)
  - The shadow is barely perceptible at normal zoom. It becomes slightly more visible when you pick up an item (drag).
  - Two shadow layers (`shadowLayer1`, `shadowLayer2` in the binary) — one tight/sharp, one broad/diffuse.
  - Shadow intensity changes dynamically: increases when item is "lifted" (dragging), decreases at rest.
  - There is also a `shadowPathAlpha` and `shadowShapeOpacity` — the shadow shape itself has alpha, creating an even softer look.
- **No visible borders at rest.** Elevation is conveyed through shadow only. When selected, a thin blue selection ring appears (~2px). Spatial uses `highlightBorder`, `highlightedBorderWidth`, `borderIntensity` for selection — the border animates in.
- **Images bleed edge-to-edge** within their cards. No internal padding on image cards. The image fills the card completely, and the rounded corners clip it.
- **Items have generous spacing.** On a typical canvas, items don't touch each other. There is always breathing room. The canvas is not dense; it is spacious and calm.

### Sticky Notes

Stickies are the most colorful elements. They are simple text cards with a solid background color.

- **Shape:** Rounded rectangle matching the item corner radius
- **Background:** Solid vivid color (NOT pastel, NOT washed out — these are punchy, Display P3 saturated colors)
- **Observed sticky colors from screenshots:**
  - Mint/Cyan green: approximately `#00F5A0` or `color(display-p3 0 0.96 0.63)` — this is VERY vivid
  - Purple/Violet: approximately `#7B68EE` or `color(display-p3 0.48 0.41 0.93)`
  - Hot pink: approximately `#FF3B7A` or `color(display-p3 1 0.23 0.48)`
  - Coral/Red: not observed but likely available
  - Additional colors available via the Color Picker (flower/leaf wheel)
- **Text on stickies:** Dark near-black text on light-colored stickies. Uses the Eina03 font family (sans-serif).
- **Text layout:** Left-aligned, with generous padding inside the sticky (~16-20px)
- **No shadow variation:** Stickies use the same subtle shadow system as other items

### Folder Visual

Folders have a distinctive 3D "tab" at the top, like a physical file folder:

- **Shape:** A rectangular card body with a **raised tab** at the top-left. The tab is narrower than the full width and has its own rounded top corners.
- **Tab construction (from binary):** `tabHeight`, `upperRadius`, `lowerRadius`, `tabCornerRadius`, `leftCornerRadius`, `rightCornerRadius` — the tab is a custom bezier shape with distinct corner radii for the tab vs body.
- **Folder body:** Has `folderShapeLayer`, `folderShapeBorderLayer`, `folderShapeBorderGradient`, `folderShapeShadowLayer1`, `folderShapeShadowLayer2`, `folderShapeColorLayer`, `folderShapeColorGradient`.
- **The tab (lid):** Has `lidShapeLayer`, `lidContainer`, `lidBorderLayer`, `lidInnerBorderLayer`, `lidBorderGradient`, `lidColorLayer`, `lidShadowGradient`, `lidHighlightBorderLayer`.
- **Sheen/gradient overlay:** The folder has a subtle gradient sheen across it (like a slight 3D lighting effect). Uses `sheenGradient`, `sheenMask`. Different sheen color sets for light/dark mode, vibrant/neutral/low-contrast/high-contrast modes.
- **Content visible inside:** From screenshot-6, when a folder is "open" (expanded), items inside are visible behind/around it on the canvas.
- **Folder label area:** Bottom section of the card shows:
  - Count: "5 Items" / "7 Items" (small text)
  - Description: "Archived ideas to keep around for later" (bold text, ~14px)
  - Icon: A layered diamond/chevron icon (the "Stack" or "layers" icon) in the bottom-right of the card
- **Can be colored:** Folders can have a background color, just like stickies. When colored, the sheen gradient adapts to the color.

### Stack Visual

Stacks create a physical "pile of papers" effect:

- **Multiple items overlap** with slight offsets, creating a fanned stack
- **Rotation:** Each item in the stack has a slight rotation angle. The binary has `rotation`, `rotationLimit`, `rotationOffset`, `rotationAngle` — items are randomly rotated within a limit (probably ±3-5 degrees)
- **Offset:** Items are offset slightly from each other so edges peek out
- **The frontmost item** is fully visible; items behind it show only their edges/corners
- **From screenshot-7:** A stack of ~4 items. The back item (a gray car photo) shows its left edge peeking out. The middle item (a red poster) shows prominently behind. The front items (a duck photo + a note card + a purple sticky) are stacked with slight offsets. The overall effect is like dropping a handful of photos on a table.

### Bottom Navigation Bar (SpaceNav)

Located at the bottom-right of the screen:

- **Space index:** Shows "09/10" format — current space number / total spaces. Regular weight, ~14px, monospace or tabular numerals so the width doesn't shift.
- **Controls:** Three icon buttons in a row:
  - Settings icon (gear): opens Space settings
  - Up/Down chevrons: navigate between spaces
  - Plus (+): create a new space
- **Visual style:** Light rounded pill background with subtle border. NOT the dark toolbar — this is a separate, lighter element.

### Bottom Toolbar (Contextual)

Appears when items are selected. Located at bottom-center of screen:

- **Shape:** Dark, nearly black (`#1A1A1E` to `#222226`) rounded pill shape
- **Corner radius:** Very generous, fully rounded ends (pill shape — radius = height/2)
- **Icons inside:** White icon buttons — Copy, Download, Trash, and contextual actions
- **Spacing:** Icons spaced evenly with ~24-32px between them
- **Shadow:** Subtle shadow below the pill to float it above the canvas
- **Appears/disappears with animation** (spring-based, slides up from below)
- From screenshot-4 (image detail view): shows clipboard/copy icon, download icon, trash icon

### Settings Button (Bottom Left)

- A single icon button in the bottom-left corner
- Icon: horizontal sliders (the "adjustments" icon — three horizontal lines with dots at different positions)
- Opens the Preferences panel

### Top Label Pills

Used for Space labels/titles:

- **Shape:** Rounded pill (fully rounded ends)
- **Background:** Bright royal blue `#0033FF` or similar saturated blue
- **Text:** ALL-CAPS, white, wide letter-spacing (`letter-spacing: 0.15em` to `0.2em`), small font (~11-13px), bold weight
- **Examples from screenshots:** "NOTES, GRAPHICS, MOTION AND WEBCLIPS", "MANAGE DAILY LIFE", "SAVE INSPIRATION", "FOLDERS TO KEEP THINGS CLEAN", "STACKS TO KEEP THINGS TOGETHER"
- **Position:** Top center of the viewport

### Back Arrow (Detail Views)

When inside a Note editor, image detail view, or folder:

- Small left-pointing arrow (←) in the top-left corner (~32px from edges)
- Thin line weight, near-black
- Click → animate back to canvas view

### Image Detail View (Expanded Image)

When double-clicking an image to expand it (screenshot-4):

- **Layout:** Full-width centered image with metadata alongside
- **Color palette circles:** Left side of image, vertically stacked circles (~24px diameter) showing 3-5 extracted dominant colors from the image. Uses `ColorSampler`, `ImagePalette`, `ColorSorter`.
- **Metadata panel:** Right side, with ALL-CAPS labels and values:
  - **RESOLUTION** — e.g., "1080 X 1350"
  - **FILENAME** — UUID-style filename in monospace
  - **DATE** — "CREATED ON MARCH 24"
  - Labels: ALL-CAPS, wide letter-spacing, small size (~10-11px), light gray color
  - Values: Regular weight, slightly larger, near-black, monospace-like appearance
- **Notes area below image:** Scrolling below the image reveals a title (bold) + body text area for writing notes about the image
- **Toolbar:** The dark floating pill toolbar appears with clipboard/download/trash

### Note Editor View (Expanded Note)

When double-clicking a note (screenshot-5):

- **Full-screen focused editing experience.** The canvas disappears; you're in a clean document view.
- **Background:** Same warm light gray as canvas (or slightly lighter/warmer)
- **Content area:** Centered, max-width ~680-720px (similar to Medium/Notion content width)
- **Typography in the editor:**
  - **H1 (Display):** Large serif font. From the screenshot: "Longer form writing for prose, concept ideas or daily lists." — this is approximately 36-42px, **serif** (likely Volkhov or New York Medium), regular weight, with generous line height (~1.3). The characters have visible serifs, thick/thin stroke contrast.
  - **H2 (Headline):** Medium serif. From the screenshot: "Welcome to your private visual repository. Your digital shoebox if you will." — approximately 22-26px, serif, regular weight, generous line height.
  - **Body text:** From the screenshot: the lorem ipsum paragraphs are approximately 16-17px, serif or sans-serif, regular weight, with comfortable line height (~1.6-1.7). Color is near-black but not pure black (maybe `#1A1A1A` or `#222222`).
  - **Checkbox items:** Small open circles (unchecked, light gray fill) or filled circles (checked, dark fill). Text next to them is regular weight, ~15-16px.
  - **Highlight marker:** Yellow background highlight `#FFFF00` or similar bright yellow, applied inline. The word "Spatial." in the screenshot has a yellow highlight behind it.
- **Back arrow:** Top-left, same as described above

### Context Menu (Popper)

Spatial has a custom context menu system (NOT native OS menus):

- **Appearance:** A floating card with rounded corners (~12px), white background, subtle shadow
- **Items:** Each menu item is a row with icon + label text
- **Dividers:** Thin horizontal lines separating groups
- **Spring animation:** The menu appears with a spring-in animation (scales from ~0.95 to 1.0 with a slight bounce)
- **Content examples:** Right-click on empty canvas → "Note", "Sticky", "Folder". Right-click on item → "Copy", "Delete", "Color", "Stack", etc.

### Checklist Appearance

- **Header:** Bold title text ("Today", "Tomorrow", "One of these days" in screenshot-2)
- **Items:** Each item is a row with a circular checkbox + text
- **Checkbox unchecked:** Open circle, light gray outline, no fill
- **Checkbox checked:** Filled dark circle
- **Multiple checkbox visual variants exist:** `small`/`medium` sizes, `light`/`dark`/`alpha` modes, `primary`/`secondary`/`tertiary`/`quaternary` hierarchy levels
- **Checked text:** May have strikethrough or reduced opacity
- **The checklist can be minimized** (collapsed to just the header)

### Web Clip Appearance

- "Magazine style web clips lets you see whole websites"
- Shows a screenshot of the captured webpage within a card
- Has a link indicator (small arrow icon) in the corner
- URL text visible below or overlaid
- Can show a loading state and a failed state

### Color Picker (the "Flower" picker)

This is one of Spatial's signature design elements:

- "A color wheel where each color resembles a leaf in a flower"
- "It presents itself by spreading its leaves, out from its center"
- "While picking through, each leaf interacts with the other nearby leaves"
- Each color is a `ColorPickerCircle` — a filled circle
- The circles radiate outward from a center point
- Hovering/selecting one circle causes neighboring circles to react (push away slightly)
- "Should feel elegant, enjoyable and distinct"
- "Able to live anywhere in the UI, as a pop over"
- Used for: stickies and folders

---

## Typography System

### Font Stack

| Token | Font | Weight | Usage |
|-------|------|--------|-------|
| Eina03-Light | Eina 03 | 300 | Subtle labels |
| Eina03-Regular | Eina 03 | 400 | Body text, UI labels |
| Eina03-SemiBold | Eina 03 | 600 | Sub-headings, emphasis |
| Eina03-Bold | Eina 03 | 700 | Headings, buttons |
| Volkhov-Regular | Volkhov | 400 | Note editor headings (serif) |
| Volkhov-Bold | Volkhov | 700 | Note editor H1 (serif) |
| NewYorkMedium-Regular | New York | 400 | Alternative serif |
| NewYorkMedium-Semibold | New York | 600 | Alternative serif headings |
| NewYorkMedium-Bold | New York | 700 | Alternative serif headings |
| Unica77LL-Regular | Unica 77 | 400 | Display/accent, metadata labels |

**For the web port:** Eina 03 is a commercial font. Use **Inter** as the sans-serif substitute (free, similar geometric feel, excellent variable font support). Use **Playfair Display** or **Lora** as the serif substitute for Volkhov (both free Google Fonts with similar thick/thin contrast). Use **JetBrains Mono** or **IBM Plex Mono** for monospace (metadata labels).

### Type Scale

| Level | Name | Size | Font | Weight | Line Height | Letter Spacing |
|-------|------|------|------|--------|-------------|----------------|
| H1 | Display | 36-42px | Serif | 400 | 1.25-1.3 | -0.01em |
| H2 | Headline | 22-26px | Serif | 400 | 1.3-1.35 | 0 |
| H3 | Subheader | 18-20px | Serif or Sans | 600 | 1.35 | 0 |
| Body | Normal | 16-17px | Sans or Serif | 400 | 1.6-1.7 | 0 |
| Small | Labels | 13-14px | Sans | 400 | 1.4 | 0 |
| Tiny | Metadata | 10-11px | Mono | 400-500 | 1.3 | 0.12-0.2em (ALL-CAPS) |
| Button | Button | 13-14px | Sans | 600 | 1.0 | 0.02em |
| Sticky | Sticky text | 14-16px | Sans | 400-600 | 1.4 | 0 |

### TypeSetting System

Spatial uses `TypeSetting` objects that encapsulate a complete text style:
- `fontSize`
- `fontSetting` (references a FontSetting → actual font name + weight)
- `letterSpacing`
- `storedLineSpacing` (line spacing within a paragraph)
- `paragraphSpacing` (space between paragraphs)
- `paragraphSpacingBefore` (space before paragraphs)

`TypeSettingPack` is a collection of TypeSettings (like a theme). There's a user preference `com.spatial.stickiesTypeSettingPack` — users can choose different typography packs for stickies.

### Text Formatting in Notes

Markdown-like shortcuts:
- Begin a line with `#` → H1 (Display)
- Begin a line with `##` → H2 (Headline)
- Begin a line with `###` → H3 (Subheader)
- `- [ ]` → unchecked checkbox
- `- [x]` → checked checkbox

Inline formatting:
- Bold (Cmd+B)
- Italic (Cmd+I)
- Underline (Cmd+U)
- Strikethrough (Cmd+X)
- Highlight/Marker (Cmd+E) — yellow background highlight
- Bullet point (Cmd+L)
- Checkbox (Cmd+T)

---

## Animation & Spring Physics

**This is what makes Spatial FEEL premium.** Every interaction ends with a spring settle. Nothing snaps rigidly — everything eases in with physics.

### Named Spring Presets

These values were reconstructed from the binary's damping/stiffness/mass parameter names and typical UIKit spring configurations:

```typescript
export const springs = {
  default:    { stiffness: 300, damping: 25, mass: 1.0 },     // general-purpose
  snappy:     { stiffness: 500, damping: 30, mass: 0.8 },     // quick, responsive
  gentle:     { stiffness: 200, damping: 20, mass: 1.2 },     // slow, graceful
  bouncy:     { stiffness: 400, damping: 15, mass: 1.0 },     // noticeable overshoot
  button:     { stiffness: 600, damping: 35, mass: 0.5 },     // snappy button press
  folder:     { stiffness: 200, damping: 28, mass: 1.0 },     // folder zoom transition
  pinch:      { stiffness: 300, damping: 30, mass: 1.0 },     // pinch-to-zoom
} as const;

export const curves = {
  curveIn:    [0.4, 0, 1, 1],      // accelerating entrance
  curveOut:   [0, 0, 0.2, 1],      // decelerating exit
  easeIn:     [0.42, 0, 1, 1],     // standard ease-in
  easeInOut:  [0.42, 0, 0.58, 1],  // standard ease-in-out
  easeOut:    [0, 0, 0.58, 1],     // standard ease-out
} as const;
```

### Where Springs Are Applied

| Interaction | Spring | What Animates |
|-------------|--------|---------------|
| Drag release | `default` | Item position from current to final |
| Resize release | `default` | Item dimensions from current to snapped |
| Item creation | `bouncy` | Scale from 0 → 1, opacity from 0 → 1 |
| Item deletion | `snappy` | Scale from 1 → 0, opacity from 1 → 0 |
| Folder zoom-in | `folder` | Camera springs to child Space position |
| Folder zoom-out | `folder` | Camera springs back to parent |
| Stack gather | `gentle` | Items spring inward to stack center |
| Stack scatter | `bouncy` | Items spring outward from stack |
| Button press | `button` | Scale down to ~0.95 on press, back to 1.0 on release |
| Popper/menu appear | `snappy` | Scale from 0.95 → 1.0, opacity 0 → 1 |
| Toast appear | `default` | Slide up from below + fade in |
| Selection ring appear | `snappy` | Border opacity 0 → 1 |

### Shadow Intensity During Drag

When you pick up (start dragging) an item:
- Shadow deepens: opacity increases, blur increases, offset increases
- Item appears to "lift off" the canvas
- This is `addShadowWithIntensity:mass:animated:` from the binary

When you release:
- Shadow springs back to resting intensity
- This is `fadeOutWithIntensity:killShadow:animated:`

Suggested CSS implementation:
```css
.item--resting {
  box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04);
  transition: box-shadow 0.3s cubic-bezier(0, 0, 0.2, 1);
}
.item--dragging {
  box-shadow: 0 4px 12px rgba(0,0,0,0.08), 0 16px 48px rgba(0,0,0,0.1);
}
```

### Inertia

Spatial uses an inertia system for drag release:
- `CanvasMovePullOutInertia` — when pulling items out of containers
- `inertia`, `inertiaTranslationOffset`, `maximumVelocity`, `velocity`, `velocityMultiplier`
- Items continue moving briefly after release, then spring to rest
- The velocity at the moment of release determines how far the item coasts

For the web: `@use-gesture/react` provides velocity data on drag end. Use that to calculate an inertia offset, then spring from the offset to the final position.

### DisplayLink Animation

Spatial uses `DisplayLinkAnimator` — a frame-synced animation driver (equivalent to `requestAnimationFrame`). This ensures all physics updates are batched per frame for smooth 60fps animation.

On the web: `framer-motion` handles this internally. For any custom physics (e.g., inertia), use `requestAnimationFrame` with a spring solver function.

---

## Interaction Patterns

### Canvas Interactions

| Interaction | Behavior |
|-------------|----------|
| Right-click empty space | Context menu: Create Note, Sticky, Folder |
| Drag on empty space | Lasso/box selection |
| Click item | Select (deselect others) |
| Shift+Click item | Toggle in/out of selection |
| Double-click Note | Open editor (expand transition) |
| Double-click Folder | Navigate into child Space (zoom transition) |
| Double-click Image | Open expanded detail view |
| Drag item | Move with inertia + spring settle on release |
| Drag from desktop | Import (images → ImageCard, text files → NoteCard) |
| Pinch (trackpad) | Zoom canvas toward pinch center |
| Ctrl+Scroll wheel | Zoom canvas toward cursor |
| Scroll wheel | Pan canvas |
| Resize handles | Corner/edge resize with snap guides |
| Cmd+S | Stack selected items |
| Cmd+S on stack | Unstack |
| Escape | Deselect / close editor / back out of folder |
| Delete / Backspace | Remove selected items |
| Cmd+Z | Undo |
| Cmd+Shift+Z | Redo |
| Arrow keys | Spatial navigation between items |

### Keyboard Navigation Model

Arrow-key navigation uses a spatial model:
- **Floor item:** The item directly below current position
- **Line neighbour:** The next item on the same horizontal line
- **Cliff edge:** The edge of a line (triggers "drop down" to next row)
- Left/Right: move to line neighbours
- Up/Down: move to floor items above/below
- Tab: cycle through items in z-order

### Deselection Triggers

From Spatial's debug logs, deselection happens on:
- Cancelled activity in item views
- Closed a stack
- Deselected in content view
- Deselected in folder
- Deselected keyboard selection in stack
- Minimized checklist
- Nothing to deselect
- Refolded a folder

### Drag States

```
MOVE : PULL : BEGAN        → item visually "lifts" (shadow deepens)
MOVE : PULL : FINISHED     → item settles with spring
MOVE : ENDING              → completing movement
MOVE : CLEAN UP            → post-move state reset
```

---

## Content Types

### Note
- Created via right-click menu or keyboard shortcut N
- "Useful for writing longer pieces of text like a concept draft"
- Block-based editor (TipTap/ProseMirror)
- Supports: Bold, Italic, Underline, Strikethrough, Highlight (yellow marker), Bullet lists, Numbered lists, Checkboxes, Headings (H1-H3), Code blocks, Dividers, Blockquotes
- Has its own toolbar when in editing mode
- Scrollable content area inside the card
- Double-click → full-screen focused editor (see Note Editor View above)

### Sticky
- Created via right-click menu or keyboard shortcut (alternate N)
- "Useful for scribbling down shorter pieces of text like a todo list or something to remember"
- Simple text card with solid background color
- Uses dedicated "sticky font" (Eina03, potentially different TypeSettingPack)
- No rich text — just plain text with wrapping
- Can be colored via Color Picker
- Created from Scratch Pad creates "Added as a Sticky"

### Image
- Drag and drop from desktop to create
- Image fills card edge-to-edge (no internal padding)
- Corner radius clips the image
- Has: color palette extraction (3-5 dominant colors as circles)
- Has: metadata panel (resolution, filename, date) — shown in detail view
- Has: notes area below image in detail view
- Export: save as PNG or JPEG to Downloads

### Folder
- Created via right-click menu or keyboard shortcut D
- "Use Folders to add structure or just to clean things up"
- 3D tab visual (see Folder Visual section above)
- Double-click to enter (animated zoom transition)
- Escape to exit
- Can be colored
- Shows item count + description
- Items can be dragged into/out of folders
- "Eject all from a Folder" shortcut

### Checklist
- Standalone checklist items on canvas (separate from checkboxes inside Notes)
- Has header sections ("Today", "Tomorrow", etc.)
- Circular checkboxes (filled = checked, open = unchecked)
- Can be minimized/collapsed
- Markdown syntax support: `- [ ]` unchecked, `- [x]` checked

### Stack
- "A Stack is a light-weight way of grouping things together"
- Select multiple items + Cmd+S → create stack
- Items overlap with rotation offset (physical paper pile effect)
- Can be opened/closed
- Items can be dragged out
- Click to cycle through items in the stack

### Web Clip
- Enter a URL → server captures screenshot
- "Magazine style web clips lets you see whole websites"
- Shows full-page screenshot within a card
- Has loading/failed states
- Link indicator icon

---

## UI Components

### Scratch Pad
- "A convenient way of writing Notes from wherever you are"
- Slide-out panel from the right edge of the screen
- Quick text input area
- Creates items in the current Space
- Can be pinned open
- Has a footer with controls

### Preferences Panel
- Opened from the Settings/sliders button (bottom-left)
- Settings include:
  - Color mode: Light / Dark / Auto (follows system)
  - Corner radius: Sharp / Soft
  - Sticky typography pack selection

### Toast Notifications
- Appears after actions (item created, exported, saved)
- Small floating card, usually at bottom-center
- Appears with spring animation, auto-dismisses

### Undo Notification
- Shows after undoable actions
- Includes "Undo" action button
- Separate from toast — shows near the toolbar area

---

## Search Architecture

Three tiers:

1. **Instant filter (client-side):** Items are in the zustand store. `Array.filter()` for title/type matching. Zero latency.
2. **Full-text search (PostgreSQL tsvector):** `search_vector` column with GIN index. Handles "find all notes containing 'elvish rebellion'". Sub-50ms.
3. **Semantic search (pgvector):** Embeds the query via OpenAI, cosine similarity against `item_embeddings`. "What do I know about political tensions in the northern kingdoms?" Returns ranked results with relevant text chunks.

**Search UI:** Cmd+K command palette. Global search across all Spaces. Results grouped by Space, filterable by item type and entity type.

---

## LLM / MCP Integration

Content is LLM-parseable by design:
- `content_text` = plain text of any item
- `content_json` = TipTap JSON (structured, parseable)
- `entity_meta` = typed JSON metadata

**REST API endpoints:**
- `GET /api/v1/items?search=query` — full-text search
- `GET /api/v1/items?semantic=query` — semantic search
- `GET /api/v1/items/:id` — single item with content
- `GET /api/v1/items/:id/links` — linked items
- `GET /api/v1/spaces` — all spaces
- `GET /api/v1/spaces/:id/items` — items in a space
- `POST /api/v1/items` — create item (LLM-driven import)

**MCP Server:** Standalone MCP server wrapping the REST API. Tools: `search_lore`, `get_entity`, `find_related`, `check_consistency`.

---

## TTRPG Worldbuilding

Data model is ready from day 1 (`entity_type` + `entity_meta` + `item_links`). UI comes in Phase 5.

- **Entity types:** Character, Location, Faction, Event, Item, Lore (custom types addable)
- **Entity metadata forms:** Structured fields per type (Character: race, class, alignment, allegiances; Location: climate, population, ruler; etc.)
- **Markdown bulk import:** Paste campaign notes. LLM extracts entities + relationships automatically.
- **Auto-linking:** LLM scans new content, identifies entity mentions, suggests cross-links.
- **Knowledge graph view:** Force-directed graph (d3-force) showing all entities and relationships.
- **Lore consistency checker:** "Does anything contradict the claim that dwarves are allergic to magic?"
- **Timeline view:** Chronological view for Event entities.

---

## Phase Breakdown

### Phase 1: Foundation (Sessions 1-3)

**Goal: Empty canvas that pans, zooms, and has Note/Sticky items persisted to Neon.**

- Next.js 15 project scaffolding with App Router, Tailwind CSS
- pnpm, ESLint, Prettier, TypeScript strict
- Neon database + Drizzle ORM + full schema migration
- **No auth.** Direct DB access. Single user.
- Custom canvas engine: `CanvasViewport` + `TransformLayer` with CSS transforms
- Camera: pan (drag empty space), zoom (pinch/Ctrl+wheel, zoom toward cursor)
- Item rendering: React components positioned absolutely in transform layer
- NoteCard + StickyCard with basic styling
- Drag-to-move items via `@use-gesture/react`
- CRUD: create (double-click empty), update position (drag end), delete (backspace), persist to Neon
- Basic Space creation and switching (sidebar or bottom nav)
- Cloudflare R2 setup for image uploads

```
src/
  stores/canvas-store.ts
  components/canvas/
    CanvasViewport.tsx
    TransformLayer.tsx
    CanvasItem.tsx
    items/NoteCard.tsx
    items/StickyCard.tsx
  lib/gestures.ts
  lib/screen-to-canvas.ts
  app/api/items/route.ts
  app/api/spaces/route.ts
  db/schema.ts
```

### Phase 2: Canvas Interactions (Sessions 4-9)

**Goal: It feels premium. Spring physics, snapping, selection, undo, stacking.**

- Selection system: click-to-select (blue ring), Shift+click, box lasso
- Resize handles: 8-handle (4 corner + 4 edge), aspect-ratio lock with Shift
- Snap guides: alignment lines to other items during drag/resize
- Spring physics on ALL position/size changes (framer-motion `animate()`)
- Named spring presets (default, snappy, gentle, bouncy)
- Undo/redo: action-based stack, Cmd+Z / Cmd+Shift+Z
- Keyboard shortcuts framework
- Stacking: select + Cmd+S = stack with rotation offsets
- Folder items: double-click = zoom-into transition to child Space
- Keyboard navigation (arrow keys spatial nav)
- Dark mode (CSS custom properties, system + manual toggle)
- Context menu (Popper-style)
- Drag-and-drop from desktop

```
src/
  components/canvas/SelectionBox.tsx
  components/canvas/SnapGuides.tsx
  components/canvas/ResizeHandles.tsx
  stores/undo-store.ts
  lib/snap.ts
  lib/springs.ts
  lib/spatial-nav.ts
  lib/shortcuts.ts
  components/canvas/items/FolderCard.tsx
  components/ui/ContextMenu.tsx
```

### Phase 3: Rich Content (Sessions 10-14)

**Goal: Full editing. Rich text, images, checklists, web clips.**

- TipTap editor in NoteCard (headings, bold, italic, underline, strikethrough, highlight, bullets, checkboxes, code, dividers)
- Content stored as `content_json` (TipTap JSON) + `content_text` (plain text)
- Image items: upload to R2, edge-to-edge display, color palette extraction
- Checklist items: standalone, animated check/uncheck
- Web clip items: URL input, server-side screenshot
- Per-item toolbar: contextual actions
- Scratch pad panel: slide-out quick input

### Phase 4: Search + Intelligence (Sessions 15-19)

**Goal: Find anything. Link everything. LLM access.**

- Full-text search: tsvector + GIN index
- Cmd+K command palette
- Cross-linking: `[[` syntax in TipTap, autocomplete, creates `item_links`
- Backlinks panel on each item
- OpenAI embeddings on item save
- Semantic search in Cmd+K
- REST API (versioned)
- MCP server

### Phase 5: TTRPG Worldbuilding (Sessions 20-25)

**Goal: Best worldbuilding tool that exists.**

- Entity type selector on items
- Entity metadata forms
- Markdown bulk import with LLM extraction
- Auto-linking (LLM identifies entity mentions)
- Knowledge graph (d3-force)
- Lore consistency checker
- Timeline view for Events

### Phase 6: Visual Polish Pass (Sessions 26-30)

**Goal: Achieve Spatial-level visual fidelity. Every shadow, every transition, every micro-interaction.**

This phase is about going from "functional" to "beautiful." Reference the Visual Design Bible section above for exact specs. Specific tasks:

- **Shadow system overhaul:** Implement dual-layer shadows (tight + diffuse). Shadow intensity animates on drag (lift effect). `shadowPathAlpha` for soft shadow edges. Test at multiple zoom levels.
- **Sheen/gradient system for folders:** Implement the subtle gradient overlay that gives folders their 3D appearance. Different sheen colors for light/dark mode.
- **Card transitions:** Every card opening (Note → editor, Image → detail, Folder → zoom-in) should have a smooth, spring-animated transition. The card should appear to expand from its position on the canvas, not just switch views.
- **Stack rotation polish:** Randomized slight rotation (±2-4 degrees) on stacked items. Smooth scatter/gather animations. The physical paper pile feel.
- **Color Picker:** Build the "flower/leaf" color picker with interactive circles that push each other when hovered. Spring-animated opening (spreading from center).
- **Selection ring refinement:** The blue selection indicator should animate in with a spring (scale + opacity). It should be a subtle glow, not a hard border.
- **Toolbar animation:** The bottom toolbar should slide up with a spring when items are selected, slide down when deselected. Icons should have micro-interactions on hover (subtle scale bump).
- **Toast/notification animation:** Slide up from bottom, spring settle, auto-dismiss with fade out.
- **Cursor changes:** Cursor should change contextually — default on canvas, grab on items, grabbing while dragging, resize cursors on handles, pointer on interactive elements.
- **Hover states:** Subtle scale bump (~1.005x) or brightness change on item hover. Not all items — just interactive elements (buttons, popper items, toolbar icons).
- **Smooth zoom:** Camera zoom should not feel stepped. It should be smooth and continuous, with slight spring settle after pinch/scroll ends.
- **Loading states:** Skeleton shimmer animation for items loading from DB. Spinner for image uploads.
- **Empty state:** When a Space has no items, show centered instructional text (matching Spatial's tone): "Start a note, drop in visuals, or just organize your thoughts."

### Phase 7: Typography & Detail Polish (Sessions 31-34)

**Goal: The typography and micro-details are indistinguishable from a native app.**

- **Font loading:** Set up proper web font loading with `font-display: swap` and preload for the primary fonts. NO flash of unstyled text.
- **Type scale audit:** Go through every piece of text in the app and verify it matches the Type Scale table above. Every label, every heading, every body paragraph, every metadata field.
- **Metadata labels:** ALL-CAPS, wide letter-spacing, small monospace-like appearance. These are used in image detail views, folder cards, and anywhere structured data is shown.
- **Line spacing in notes:** The note editor should have generous paragraph spacing. Reading text in heartgarden should feel like reading a well-typeset book, not a dense code editor.
- **Custom caret:** Spatial has a `CustomCaret` — consider making the text cursor slightly thicker or colored to match the app's personality.
- **Bullet/checkbox polish:** Implement the exact circular checkbox style (small open circle → filled dark circle). Bullet points should be small filled circles, not the browser default. Reference `bullet-medium-point-dark`, `bullet-medium-point-light` assets.
- **Link arrows:** Items that reference external URLs should show a small right-pointing arrow icon.
- **Responsive text sizing:** At extreme zoom levels, text in items should remain sharp (use `transform-origin` and avoid scaling text — let the browser render it at native resolution).

### Phase 8: Performance & Deployment (Sessions 35-38)

**Goal: 60fps with 500+ items. Installable PWA.**

- **Viewport culling:** Only render items whose bounding box intersects the visible viewport (+ buffer zone). Items outside the viewport are unmounted from the DOM entirely.
- **will-change hints:** Apply `will-change: transform` to the transform layer and actively dragged items. Remove after animation completes.
- **Debounced DB sync:** Item mutations are batched and synced to Neon with a 500ms debounce. Optimistic UI — the store updates immediately, DB sync happens in the background.
- **Image optimization:** Serve different image sizes based on zoom level. At low zoom, use thumbnails. At high zoom, load full resolution.
- **Bundle analysis:** Ensure framer-motion tree-shaking is working. Target <200KB JS initial load.
- **Onboarding flow:** First-run overlay with Spatial-style instructional hints. "This is yours to fill."
- **Preferences panel:** Color mode, corner radius, snap sensitivity, spring feel.
- **Canvas minimap:** Small overview in corner showing all items as colored dots.
- **Export:** Full JSON backup, per-space markdown export, per-item markdown.
- **Import:** JSON restore, markdown import.
- **PWA:** Service worker, offline capability, installable to dock/home screen.

---

## Reference Screenshots

The following App Store screenshots from Spatial are included as `spatial-reference-images/` alongside this plan. These are the visual benchmark. heartgarden should match this level of visual quality.

### screenshot-1.jpg — Main Canvas Overview
Shows the full canvas with a mix of content types: 3 car photos (edge-to-edge in cards), a duck photo with "Quack!" sticky overlaid, a red graphic design poster, multiple note cards with text, a checklist with "Today/Tomorrow/One of these days" sections, a folder card ("7 Items - Archived ideas to keep around for later"), and a small web clip. The canvas background is warm light gray. All items float with subtle shadows. Items are spaced generously. The blue pill label at top reads "NOTES, GRAPHICS, MOTION AND WEBCLIPS". Bottom-left shows the sliders/settings icon. Bottom-right shows "09/10" space nav with gear, chevrons, and plus.

### screenshot-2.jpg — Daily Life Use Case
Focused on practical items: a green "Paris flight" sticky (with confirmation code, date, terminal info — Eina font, left-aligned), a "Pack" checklist (Toothbrush, 2 tees, gym bag, MacBook — circular checkboxes), a "Today/Tomorrow/One of these days" checklist spanning the middle, a "Spotify" sticky with account/password info, a "Get this for Stephanie's birthday" note card with a link to teenage.engineering, a large image of a synthesizer product page (web clip), and an "Inbox" folder showing "2 Items". The floating dark toolbar is visible at bottom-center with 4 icon buttons. Green stickies use the vivid mint green color.

### screenshot-3.jpg — Inspiration Mood Board
Dense layout of images arranged closely (almost touching). Car photos, an illustration of a snail creature, graphic design posters (Bücher, Bauhaus, Faust, Indie), a duck photo, and typography/grid design samples. A pink sticky ("Bring some of this into the website header.") overlays one of the images. A small sticky ("Love these vibes.") sits in the lower left. The dark toolbar is partially visible at bottom. This shows that Spatial supports dense/packed layouts as well as sparse ones.

### screenshot-4.jpg — Image Detail View
Full expanded view of a car photo. Left side: 3 color palette circles (light gray, dark gray/black, red) stacked vertically at ~24px diameter each. Center: large image filling the width. Right side: metadata panel with ALL-CAPS labels — "RESOLUTION / 1080 X 1350", "FILENAME / 68EFBAAC-DEAA-4B3A-A88D-8673CC0B92C7.PNG", "DATE / CREATED ON MARCH 24". Below image: "Cropped close-up" title in bold + lorem ipsum body text. Back arrow (←) top-left. Dark toolbar at bottom with clipboard, download, trash icons.

### screenshot-5.jpg — Note Editor
Full-screen note editing. Clean white/gray background. Centered content ~680px wide. Large serif heading: "Longer form writing for prose, concept ideas or daily lists." (~40px, serif, regular weight). Below: "Welcome to your private visual repository. Your digital shoebox if you will." (~24px, serif, regular weight). Then checkbox items with open circles. Then "This is the beauty of Spatial." — the word "Spatial." has a YELLOW HIGHLIGHT (marker) behind it. Below: more checkbox items. Then: body paragraphs in regular serif/sans at ~16px. Generous line spacing. Back arrow top-left.

### screenshot-6.jpg — Folders
Shows a folder card at bottom-center: rounded rectangle with 3D tab at top, light/white background, "5 Items / Archived ideas to keep around for later" text + layers icon at bottom-right. Behind/around the folder: items that are inside it are visible on the canvas (a duck photo, note cards, a green sticky labeled "Summer house" with "Lindby_88" and "RubberDuck1291"). Blue pill label at top: "FOLDERS TO KEEP THINGS CLEAN".

### screenshot-7.jpg — Stacks
Shows a stack of ~4 items overlapping with slight rotation. Back-most: a gray car photo peeking from the left edge. Middle: a red poster visible on the right side. Front: the duck photo, overlapping a "Brief" note card, overlapping a purple "Apartment" sticky. Items are rotated ±3-5 degrees, offset by ~20-40px. The visual effect is like a pile of photos dropped on a table. Blue pill label: "STACKS TO KEEP THINGS TOGETHER".

### screenshot-8.jpg — Brand / Splash
Centered on a very light blue-gray background (#F0F2F5 approximately). The Spatial logo: two overlapping offset rounded squares, drawn with thick black strokes. Next to it: "your digital shoebox." in large bold sans-serif (Eina03-Bold, ~36-40px). Below in the center of the screen, small text: "Spatial." in medium weight.

### app-icon-512.png — App Icon
Two overlapping rounded squares on a dark gradient background (dark gray → black). The squares are drawn with thick white strokes (~4-5% of icon width). One square sits behind, offset up and to the right. The overlapping region creates a shared corner. Clean, geometric, minimal. The icon represents spatial arrangement / overlapping canvases.

---

## Source File Map (Reference)

The complete Swift source file tree of Spatial.app (120 files), for understanding its internal architecture:

```
Untitled/
├── MainController.swift
├── CoreDataServer.swift, CoreDataStack.swift
├── AnimationView.swift, FPSBadge.swift
├── Canvas/
│   ├── CanvasView, CanvasContentView, CanvasScrollView, CanvasPlaygroundView
│   ├── CanvasEditor, CanvasItem, CanvasItemView, CanvasToolbar
│   ├── CanvasHintLabel, CanvasLayoutBuilder, CanvasDragger, CanvasLasso
│   ├── CanvasMoveAnimator, CanvasItemsAnimator, CanvasSnapContext
│   ├── Images/ (CanvasImageView, CanvasImageTransitionView)
│   ├── Notes/ (CanvasNotesView, CanvasNotesTransitionView)
│   ├── Stickies/ (CanvasStickyView, StickyTextView)
│   ├── Videos/ (CanvasVideoView, CanvasVideoTransitionView, CanvasVideoProgressBar)
│   ├── WebClips/ (CanvasWebClipView, CanvasWebClipTransitionView, + 3 more)
│   ├── Folders/ (CanvasFolderView, FolderCanvasView, CanvasFolderTransitionView,
│   │            CanvasFolderDropAnimator, FolderCreateBar, FolderEditor)
│   ├── Resizing/ (CanvasResizeHandle, CanvasCornerResizeHandle,
│   │             CanvasEdgeResizeHandle, CanvasResizeSnapper, CanvasResizeSnapHighlight)
│   └── Transitions/ (CanvasTransitionView, + 5 content-specific transition views)
├── Checklist/ (CanvasChecklistView, Checkbox, ListHeaderView, ListItemView, ListView)
├── Notes/ (NotesBlockView, NotesBlockTextView, NotesToolbar, CustomTextView, CustomCaret)
├── Components/ (BaseView, Badge, Button, Label, Blur, Glass, Gradient, Tooltip, etc.)
├── Color/ (ColorPicker, ColorPickerCircle, ColorPaletteView)
├── Items/ (ItemEditor, ImageToolbar, MetadataView, WebClipEditor, etc.)
├── Panels/ (PreferencesPanel, ScratchPadContentView, ToastPanel, UndoNotificationView)
├── Popper/ (Popper, PopperDivider, PopperItemView)
└── Unboxing/ (UnboxingView, UnboxingLidView, + 7 more onboarding views)
```

---

## Keyboard Shortcuts (Complete)

### On Canvas
| Key | Action |
|-----|--------|
| N | Create a Note |
| (alternate) N | Create a Sticky |
| D | Create a Folder |
| (alternate) D | Eject all from a Folder |
| S | Create a Stack |
| (alternate) S | Unstack a Stack |
| G | Create a Grid |
| Cmd+Z | Undo |
| Cmd+Shift+Z | Redo |
| Arrow keys | Spatial navigation between items |
| Delete / Backspace | Delete selected items |
| Enter | Open selected item |
| Escape | Deselect / close editor |
| Cmd+K | Command palette (search) |

### In Notes Editor
| Key | Action |
|-----|--------|
| Cmd+B | Bold |
| Cmd+I | Italic |
| Cmd+U | Underline |
| Cmd+X | Strikethrough |
| Cmd+E | Highlight (yellow marker) |
| Cmd+L | Bullet point |
| Cmd+T | Checkbox |
| Cmd+1 | H1 (Display) |
| Cmd+2 | H2 (Headline) |
| Cmd+3 | H3 (Subheader) |
| Cmd+4 | Normal/body |

---

*This document was compiled on April 2, 2026 by reverse-engineering Spatial.app v1.0.2 (build 45) on macOS. The app is macOS-only and cannot be further inspected after leaving the source machine. All information here is final.*
