---
name: Canvas navigation UX
overview: Extend Cmd+K, shared viewport helpers, top-left minimap, and out-of-view toast; add space navigation hardening (cancel stale bootstrap), vault index transparency, and editor-assisted wiki linking—aligned with existing Neon index debounce and contentEditable note bodies.
todos:
  - id: bounds-lib
    content: "Add canvas-view-bounds.ts: AABB per entity/stack, rotation expansion, fitCameraToBounds; refactor palette zoom-fit to use it"
    status: pending
  - id: minimap
    content: Build CanvasMinimap (SVG, viewport rect, click/drag/dblclick); mount under shellTopLeftStack with chrome styles; hide in focus/gallery/stack modal/boot
    status: pending
  - id: toast
    content: Add debounced out-of-view detection + CanvasViewportToast with Show (fit all) and dismiss + cooldown
    status: pending
  - id: palette
    content: Expand CommandPalette action caps/sections; add zoom-to-selection, toggles (effects, link graph, lore); fix icons; wire runPaletteAction
    status: pending
  - id: space-nav-hardening
    content: enterSpace generation token; ignore stale fetchBootstrap/merge results; safe navTransitionActive teardown for rapid space switches
    status: pending
  - id: vault-index-ui
    content: Track debounced index + POST outcomes; surface status in status bar and/or per-card affordance; handle 429/skipped/no-API-key gracefully
    status: pending
  - id: wiki-link-assist
    content: "[[ trigger + suggest list (titles + search); insert vigil:item HTML anchors in BufferedContentEditable / focus editor"
    status: pending
  - id: tests
    content: Unit tests for bounds helper + space-nav generation; optional Storybook for minimap; light tests for link-assist parser if extracted
    status: pending
isProject: false
---

# Canvas navigation and Cmd+K hardening

## Context (current code)

- **Camera model:** The scene uses `transform: translate(${translateX}px, ${translateY}px) scale(${scale})` on the canvas root ([ArchitecturalCanvasApp.tsx](c:/Users/Brett/Desktop/Cursor/vigil/src/components/foundation/ArchitecturalCanvasApp.tsx) ~7548). Screen-to-world for a viewport-local point is consistent with existing helpers such as `centerWorldX` / `centerWorldY` (~7302): `world = (screen - translate) / scale`.
- **Top-left chrome:** Fixed column [`shellTopLeftStack`](c:/Users/Brett/Desktop/Cursor/vigil/src/components/foundation/ArchitecturalCanvasApp.module.css) (flex column) holds `shellTopCluster` → `shellTopClusterRow` (status bar, optional log out, breadcrumbs). This is the correct anchor for “top left, under” the existing strip—add a **second block below** the cluster (sibling inside `shellTopLeftStack`), not under the right-side [`ArchitecturalToolRail`](c:/Users/Brett/Desktop/Cursor/vigil/src/components/foundation/ArchitecturalCanvasApp.tsx).
- **Stacks:** `collapsedStacks` groups multi-card stacks; each stack is positioned at `top.slots[activeSpaceId]` with CSS fan-out (`--stack-x` / `--stack-y`). The minimap and bounds logic must treat a **collapsed stack as one footprint**, not N overlapping cards at the same slot.
- **Zoom-to-fit today:** Palette action `zoom-fit` (~5041–5077) uses **fixed** `UNIFIED_NODE_WIDTH` and `260` height for every entity—wrong for folders and stacks. This plan replaces that with a **shared bounds + fit** helper used by palette, minimap click-drag, and the toast action.
- **Note bodies:** Card and focus editing use [`BufferedContentEditable`](c:/Users/Brett/Desktop/Cursor/vigil/src/components/editing/BufferedContentEditable.tsx), not TipTap—editor-assisted linking must work in **HTML contentEditable** (selection, ranges, IME).
- **Vault index:** Debounced client trigger in [`architectural-neon-api.ts`](c:/Users/Brett/Desktop/Cursor/vigil/src/components/foundation/architectural-neon-api.ts) (`scheduleVaultIndexForItem`, `VAULT_INDEX_DEBOUNCE_MS` ~2800) POSTs to [`/api/items/[itemId]/index`](c:/Users/Brett/Desktop/Cursor/vigil/app/api/items/[itemId]/index/route.ts) (returns `ok`, `chunks`, `loreMetaUpdated`, `skipped`, or errors / 429).

## 1. Shared world bounds and “fit camera” helper

**New module** (keeps [ArchitecturalCanvasApp.tsx](c:/Users/Brett/Desktop/Cursor/vigil/src/components/foundation/ArchitecturalCanvasApp.tsx) from growing further): e.g. [`vigil/src/lib/canvas-view-bounds.ts`](c:/Users/Brett/Desktop/Cursor/vigil/src/lib/canvas-view-bounds.ts).

- **Inputs:** `CanvasGraph`, `activeSpaceId`, `collapsedStacks` (or derive from the same `stackGroups` logic the shell already uses), viewport pixel size, optional `entityIds` subset (for “selection only”).
- **Per-entity axis-aligned box in world space:**
  - **Folder:** `FOLDER_CARD_WIDTH` / `FOLDER_CARD_HEIGHT` ([constants in ArchitecturalCanvasApp.tsx](c:/Users/Brett/Desktop/Cursor/vigil/src/components/foundation/ArchitecturalCanvasApp.tsx) ~184–187).
  - **Content:** `entity.width ?? UNIFIED_NODE_WIDTH`, default height **280** (match zoom-fit and placement fallbacks).
  - **Rotation:** expand using the four corners of the local rect rotated by `entity.rotation` (simple trig); avoids underestimating hit area for rotated cards.
- **Stacks (collapsed, len > 1):** one box anchored at the **stack container slot** (`top` of `collapsedStacks` entry). Footprint = card box plus **diagonal spill** from fan-out: e.g. extra `(n - 1) * 6` px on right/bottom (aligned with `--stack-x` / `--stack-y` in JSX ~7673–7675), capped to a reasonable max so pathological stacks do not explode the minimap. Optionally union with the same rotation expansion as the **top** card if you want tighter accuracy later.
- **Standalone entities** (single-card “stack” or no `stackId`): same as today’s node placement.
- **Outputs:**
  - `contentBounds: { minX, minY, maxX, maxY } | null` (null if no entities in space).
  - `fitCameraToBounds(bounds, viewportSize, paddingPx, minZoom, maxZoom)` returning `{ scale, translateX, translateY }` using the same fitting math as current `zoom-fit` but with correct width/height per item/stack.

**Refactor:** `runPaletteAction` `zoom-fit` calls the helper for **all space entities**; new actions **“Zoom to selection”** and minimap interactions call it with **selected ids** or **click target** (see below).

## 2. Top-left minimap component

**New component** + CSS module: e.g. [`vigil/src/components/foundation/CanvasMinimap.tsx`](c:/Users/Brett/Desktop/Cursor/vigil/src/components/foundation/CanvasMinimap.tsx) + `CanvasMinimap.module.css`.

- **Placement:** Render inside [`shellTopLeftStack`](c:/Users/Brett/Desktop/Cursor/vigil/src/components/foundation/ArchitecturalCanvasApp.tsx) **after** the existing `shellTopCluster` block (~9215–9311), wrapped in a glass panel consistent with `shellTopChromePanel` / tokens. Apply `pointer-events: auto` on the minimap only (parent column uses `pointer-events: none` except rows).
- **Visual (best-practice pattern):** Fixed **~168–200px** wide (height ~112–140), `border-radius` matching chrome, subtle border. **SVG** `viewBox` set to `contentBounds` plus **~8–12% padding** (or minimum absolute padding in world units so tiny gardens still breathe). Inside SVG:
  - **Fill rects** per atom (standalone node or stack): low-contrast fill; **slightly stronger** for selected entities (derive selected set from `selectedNodeIds` + stack membership).
  - **Viewport quad:** rectangle for the visible world rect:
    - `worldMinX = -translateX / scale`, `worldMinY = -translateY / scale`, `worldMaxX = worldMinX + viewportWidth / scale`, `worldMaxY = worldMinY + viewportHeight / scale` (use `viewportSize` from shell state, not `window`, for consistency).
  - **Optional:** hairline **world origin** crosshair at (0,0) only when bounds include origin (debug affordance; can omit if cluttered).
- **Extreme spread:** Single scale from bounds → viewBox already “zooms out” the entire minimap; clamp **minimum** world-per-pixel so dots never disappear entirely; if content area &gt; huge threshold, **cap viewBox** to bounds (still correct) and rely on thin rects—no need to subsample for v1.
- **Interactions:**
  - **Click** empty area: center camera on clicked world point (preserve current scale or optional gentle clamp).
  - **Drag viewport rect** (Figma-like): pointer capture on the viewport outline; map minimap delta to `translateX/translateY` changes at current `scale`.
  - **Double-click** minimap background: run **fit all** (same as improved `zoom-fit`).
- **Accessibility:** `aria-label="Canvas minimap"`, keyboard optional v2; ensure minimap does not trap tab order (use `tabIndex={-1}` on internal controls if needed).
- **When hidden:** `focusOpen`, `galleryOpen`, `stackModal`, `bootPreActivateGate`, or empty space → return `null` or a collapsed “inactive” state.

**Performance:** Derive minimap geometry from **graph + collapsedStacks + camera** in `useMemo`; avoid `getBoundingClientRect` per frame (DOM measurement is already used elsewhere for stack selection bounds; minimap v1 stays model-based).

## 3. “Snap to content” toast (Figma-style)

**No existing toast library** in the repo (grep is clean)—implement a **small local component** (e.g. `CanvasViewportToast`) portaled under the chrome layer or fixed `bottom` center with glass styling, **primary button “Show”** and dismiss (× or click-off).

- **Detection (debounced):** After `scale` / `translateX` / `translateY` / `viewportSize` / graph layout change, **debounce ~400–500ms** and compute whether **`contentBounds`** intersects the **viewport world rect** above some threshold (e.g. intersection area &lt; 2% of content area, or **zero** intersection → show toast). Re-run when `activeSpaceId` changes; **clear** toast when intersection is good or user clicks **Show**.
- **Triggers to suppress noise:** Do not show while `focusOpen`, `galleryOpen`, `stackModal`, palette/lore modal open, or **empty** `contentBounds`. Optional **cooldown** (e.g. 20s) after dismiss without “Show” so power users are not nagged.
- **“Show” action:** Call shared `fitCameraToBounds` on **full space bounds** (same as improved zoom-fit).
- **Reduced motion:** Respect `prefers-reduced-motion` for slide/fade.

## 4. Cmd+K as universal escape hatch

**Files:** [CommandPalette.tsx](c:/Users/Brett/Desktop/Cursor/vigil/src/components/ui/CommandPalette.tsx), [ArchitecturalCanvasApp.tsx](c:/Users/Brett/Desktop/Cursor/vigil/src/components/foundation/ArchitecturalCanvasApp.tsx) (`paletteActions`, `runPaletteAction`).

- **Raise visibility when query is empty:** Today `filteredActions` caps at **6** rows when `qq` is empty (~299–307)—too aggressive as the action list grows. Increase cap (e.g. **12–16**) or split **“Actions”** into always-visible section headers (Recent / Actions / Navigate) without shrinking actions below usability.
- **New / clarified actions** (wire to existing state setters where they already exist):
  - **Zoom to selection** — disabled when selection empty; uses bounds helper on selected ids (+ stack expansion: if any selected id is in a multi-stack, include whole stack for a sensible frame).
  - **Toggle canvas effects** — `setCanvasEffectsEnabled` + persist key `VIGIL_CANVAS_EFFECTS_STORAGE_KEY` ([vigil-canvas-prefs.ts](c:/Users/Brett/Desktop/Cursor/vigil/src/lib/vigil-canvas-prefs.ts)); keywords: `motion`, `transition`, `performance`.
  - **Toggle link graph** — toggle `graphOverlayOpen` (not only open).
  - **Open / close Ask lore** — toggle `lorePanelOpen`.
  - **Recenter / Zoom to fit** — keep; ensure hints reference Cmd+K ([mod-keys](c:/Users/Brett/Desktop/Cursor/vigil/src/lib/mod-keys.ts)).
- **Icon hygiene:** Replace incorrect / duplicate icons (e.g. `toggle-theme` and `create-media` both using misleading glyphs per current code ~4359–4365) so scanability matches labels.
- **Optional (if low cost):** **Open links inspector** — today [ArchitecturalLinksPanel](c:/Users/Brett/Desktop/Cursor/vigil/src/components/ui/ArchitecturalLinksPanel.tsx) owns UI state internally; either add controlled `open` / `onOpenChange` + refocus, or defer and document as follow-up.

**Restricted layer:** Continue to filter actions with the same `deny` set as today for `isRestrictedLayer`.

## 5. Space navigation hardening

**Problem:** [`enterSpace`](c:/Users/Brett/Desktop/Cursor/vigil/src/components/foundation/ArchitecturalCanvasApp.tsx) kicks off `fetchBootstrap(spaceId)` in two async paths (canvas effects off ~4071–4099, effects on ~4103–4144). Rapid breadcrumb or folder hops can complete **out of order**; an older response can call `applySpaceNavigation` last and overwrite graph + camera with the wrong space (noted in [BUILD_PLAN.md](c:/Users/Brett/Desktop/Cursor/vigil/docs/BUILD_PLAN.md) near-term item).

**Approach:**

- Add a monotonic **`spaceNavGenerationRef`** (or `useRef(0)` counter). On each `enterSpace(targetId)` call: increment; capture `const gen = ++ref` and `const target = spaceId`.
- In **both** async branches, after `await fetchBootstrap` (and after timed sleeps in the effects-on branch), **guard** before `applySpaceNavigation`:
  - If `gen !== spaceNavGenerationRef.current` **or** `target !== pendingSpaceIdRef.current` (optional second check), **return** without mutating graph, camera, `navigationPath`, or `navTransitionActive`.
- **`setNavTransitionActive(false)`** must run only for the **winning** navigation (or use a finally that checks generation before clearing), so a slow stale job does not clear the transition flag while a newer navigation is mid-flight.
- Optionally **AbortController** on `fetch` if you add abort support to bootstrap client; generation token is sufficient if fetch cannot be aborted.

**Verification:** Manual rapid clicks on crumbs; optional unit test around a small extracted “shouldApplyNavigation(gen, currentGen)” helper.

## 6. Vault index transparency

**Goal:** Users understand when semantic / hybrid search and lore retrieval reflect their latest edits.

**Server:** [`POST /api/items/[itemId]/index`](c:/Users/Brett/Desktop/Cursor/vigil/app/api/items/[itemId]/index/route.ts) already returns structured JSON (`ok`, `chunks`, `loreMetaUpdated`, `skipped`, errors, 429). Client today **fire-and-forgets** in `scheduleVaultIndexForItem`.

**Client / UX:**

- Extend [`architectural-neon-api.ts`](c:/Users/Brett/Desktop/Cursor/vigil/src/components/foundation/architectural-neon-api.ts) (or a tiny [`vault-index-status-bus.ts`](c:/Users/Brett/Desktop/Cursor/vigil/src/lib/vault-index-status-bus.ts)) to emit:
  - **Pending:** when a debounce timer is scheduled for `itemId`.
  - **In flight / done / error:** when the POST resolves (parse JSON; map 429 to “rate limited”).
- **Status bar** ([`ArchitecturalStatusBar.tsx`](c:/Users/Brett/Desktop/Cursor/vigil/src/components/foundation/ArchitecturalStatusBar.tsx)): additive strip when `pendingCount > 0` (“Indexing notes for search…”) and brief success/error toast-line when batch completes (without fighting existing neon sync copy—use a second segment or tooltip).
- **Per-card (optional v1.1):** subtle icon or dot on card chrome when that `itemId` is pending/failed; clears on success. Keeps power users confident without cluttering empty canvases.
- **No OpenAI key / skipped:** surface “Search is lexical only” or use `skipped` from API when present so users do not assume vectors updated.

## 7. Editor-assisted linking

**Goal:** When typing wiki-style links, suggest targets and insert correct **`vigil:item:`** markup so [ArchitecturalLinksPanel](c:/Users/Brett/Desktop/Cursor/vigil/src/components/ui/ArchitecturalLinksPanel.tsx) and cloud tooling stay consistent.

**Trigger:** Detect `[[` in the active editable surface ([`BufferedContentEditable`](c:/Users/Brett/Desktop/Cursor/vigil/src/components/editing/BufferedContentEditable.tsx) on cards and focus sheet in `ArchitecturalCanvasApp`). On `[[`, open a **positioned popover** anchored to the caret (`getBoundingClientRect` from `Selection.getRangeAt(0)`), filtered as the user types until `]]`, Enter, or Escape.

**Candidates (tiered):**

1. **Local fast path:** Titles (and optional aliases) of **entities in `activeSpaceId`** matching prefix (case-insensitive).
2. **Remote (when cloud + UUID space):** Reuse [`/api/search/suggest`](c:/Users/Brett/Desktop/Cursor/vigil) (same as palette) for query ≥ 2 chars to pull in cross-folder items if desired; throttle to avoid spam.

**Insertion:** Replace the `[[query` segment with HTML that existing parsers treat as wiki targets—e.g. `<a href="vigil:item:UUID">Title</a>` (validate against how `extractVigilIdsFromHtml` / consumers expect attributes). Handle **IME composition** (`isComposing`) and **undo**: prefer one atomic `onCommit` path via existing buffer where possible.

**Scope control:** Only **content** notes (not media/code if inappropriate); respect `isRestrictedLayer` / Players tier if those editors are read-only.

**Follow-ups (out of scope unless time):** Auto-suggest `@mentions` without `[[`; LLM-ranked suggestions ([FOLLOW_UP.md](c:/Users/Brett/Desktop/Cursor/vigil/docs/FOLLOW_UP.md) Phase 5 themes).

## 8. Verification

- **Unit tests** for `canvas-view-bounds.ts`: folder vs note sizes, rotated AABB expansion, collapsed stack footprint, empty space.
- **Unit tests** for space-nav generation guard (if extracted).
- **Manual / Storybook:** Story for `CanvasMinimap` with mock bounds + fake camera.
- **E2E (optional):** Open palette → run “Zoom to selection” with multi-select; smoke minimap click pans camera; rapid space switch does not flash wrong space.

```mermaid
flowchart LR
  subgraph inputs [Inputs]
    graph[CanvasGraph]
    stacks[collapsedStacks]
    cam[camera scale tx ty]
    vp[viewportSize]
  end
  subgraph lib [canvas-view-bounds]
    bounds[contentBounds AABB]
    fit[fitCameraToBounds]
  end
  subgraph ui [UI]
    mini[CanvasMinimap]
    toast[ViewportToast]
    palette[CommandPalette actions]
  end
  graph --> bounds
  stacks --> bounds
  bounds --> mini
  bounds --> fit
  cam --> mini
  vp --> mini
  cam --> toast
  vp --> toast
  bounds --> toast
  fit --> palette
  fit --> toast
  fit --> mini
```
