# heartgarden Functional PRD (UI-Agnostic Rebuild)

## Goal

Rebuild heartgarden from scratch on a new interface while preserving existing product behavior, data contracts, and user workflows.

This document intentionally excludes visual/style/chrome requirements and focuses only on functionality.

## Product Summary

heartgarden is a spatial knowledge canvas for solo worldbuilding and investigation work. Users place and edit structured content cards on an infinite canvas, connect ideas through internal links, organize work into spaces/folders, and query the corpus via keyword or semantic search.

Core behaviors:
- Infinite canvas with pan/zoom, drag, resize, lasso selection, snapping.
- Multiple card types (`note`, `sticky`, `checklist`, `image`, `webclip`, `folder`).
- Local-only mode (no DB) and cloud mode (Neon/Postgres-backed).
- Rich text editing with TipTap and wiki-style internal linking.
- Backlinks, graph view, timeline view, entity tagging.
- Import/export JSON workflows.

## Scope and Non-Goals

### In Scope
- Re-implement all currently shipped functional workflows and API contracts.
- Preserve existing data model semantics and backward compatibility where practical.
- Keep local mode and cloud mode parity for core canvas operations.

### Out of Scope
- Pixel/visual parity with current UI.
- Theming/light-dark behavior and visual polish details.
- Auth/multi-user collaboration (not currently implemented).

## Users and Primary Jobs

- Solo creator/researcher who wants to:
  - Capture ideas as cards quickly.
  - Arrange and connect information spatially.
  - Jump between related notes.
  - Search by keywords and semantic meaning.
  - Organize projects into spaces and subspaces.

## Functional Architecture

- Frontend shell orchestrates state, keyboard interaction, overlays, and API calls.
- Zustand store maintains canvas runtime state (camera, items, selection, interaction state, undo/redo stacks).
- API layer handles bootstrap, item/space CRUD, links, graph, search, upload presign, and webclip metadata.
- DB (when configured) stores canonical spaces/items/links (legacy `item_embeddings` rows may exist but are not populated).
- Local mode falls back to localStorage snapshot persistence.

## Runtime Modes

### 1) Local/Demo Mode
Activated when DB is unavailable or e2e bootstrapping forces demo behavior.

Behavior:
- App starts with `spaceId = null`.
- Items and camera are loaded from/saved to localStorage key `vigil-canvas-local-v1`.
- Features requiring server-side graph/search/link tables degrade gracefully.

### 2) Cloud Mode
Activated when DB is available.

Behavior:
- App resolves active space on bootstrap.
- Item updates are debounced and persisted via API. **Viewport** (pan/zoom) is debounced to **`localStorage`** per space (`heartgarden-space-camera-v1`), not to Neon.
- Server-backed search, links, and graph are enabled.

## Data Model (Behavioral Contract)

## `CanvasItem`
- `id: string`
- `spaceId: string`
- `itemType: "note" | "sticky" | "image" | "checklist" | "webclip" | "folder"`
- Geometry: `x`, `y`, `width`, `height`, `zIndex`
- Content: `title`, `contentText`, optional `contentJson`
- Media fields: optional `imageUrl`, `imageMeta`
- Classification fields: optional `entityType`, `entityMeta`
- Grouping fields: optional `stackId`, `stackOrder`

## `CameraState`
- `x`, `y`, `zoom`

## Persistence Tables (Cloud)
- `spaces`: includes parent-child hierarchy; `canvasState` is legacy (shell does not persist camera there).
- `items`: canonical item rows.
- `space_presence`: optional heartbeats for soft “others here” UI.
- `item_links`: directed edges between items in same space.
- `item_embeddings`: optional legacy table; search is full-text + trigram only.

## Core User Workflows

## 1) App Bootstrap and Space Resolution
- Client requests bootstrap payload.
- If local/demo, initialize empty/local state.
- If cloud:
  - Resolve active space from URL `?space=<uuid>` when valid.
  - If missing/invalid, fall back to first space.
  - If no spaces exist, create a default “Main space”.

## 2) Canvas Navigation and Selection
- Pan with background drag and trackpad/wheel.
- Zoom with Ctrl/Cmd + wheel centered under cursor.
- Lasso selection via Shift + drag on background.
- Double-click background creates a note at clicked world position.

## 3) Item Create/Edit/Delete
- Create card at world position using per-type defaults.
- Drag and resize cards with immediate local updates.
- Persist updates:
  - Local mode: localStorage snapshot.
  - Cloud mode: debounced PATCH requests.
- Delete selected items with keyboard or selection actions.

## 4) Undo/Redo and Duplication
- Undo/redo keyboard operations supported.
- Duplicating selected cards offsets position and creates new IDs.
- Stack command groups selected cards by `stackId` with ordered indices.

Important current limitation to preserve or intentionally improve:
- Undo stack is fully wired for move/create/delete.
- Patch-style edits are partially represented in types but not broadly recorded in editor flows.

## 5) Rich Text Editing and Internal Linking
- Note/checklist cards use TipTap with JSON + plaintext outputs.
- On text change:
  - Persist `contentJson`, `contentText`, and title from first line.
- Wiki/internal links:
  - `[[...]]` helper UI to select target item.
  - Inserted links use `vigil:item:<uuid>`.
- In cloud mode, outgoing links are synced to `item_links` after debounce.

## 6) Spaces and Folder Semantics
- Users can create/switch spaces.
- Folder cards represent child spaces:
  - Create child space first.
  - Create folder item in parent with `entityMeta.childSpaceId`.
- Double-click folder opens child space.

## 7) Search and Command Surface
- Global command palette opens via Cmd/Ctrl+K.
- Search modes:
  - `fts`: Postgres full-text.
  - `semantic`: vector similarity.
  - `hybrid`: keyword + semantic expansion.
- Local mode fallback: client-side substring filter.
- Command palette also exposes non-search actions (e.g., export, scratch pad).

## 8) Backlinks, Graph, Timeline, Entity Metadata
- Backlinks panel:
  - Local mode derives links from item content.
  - Cloud mode reads resolved links from API (`incoming`/`outgoing`).
- Graph overlay:
  - Uses items and `item_links` for node-edge graph.
- Timeline:
  - Filters items where `entityType === "event"`.
  - Sorts by `entityMeta.eventDate`.
- Entity type/meta editing:
  - Single selected note can be tagged and enriched with structured fields.

## 9) Import / Export
- Export full canvas snapshot to JSON (`camera`, `items`, timestamp).
- Import JSON:
  - Validate structure.
  - Local mode replaces local state.
  - Cloud mode creates new rows and patches camera.
  - Warn user about potential stale item-link UUID references.

## 10) Image Flow
- Users add images via drag/drop or picker.
- Local mode:
  - Create object URL preview card.
- Cloud mode:
  - Request presigned upload URL.
  - Upload binary directly.
  - Create item with stored media URL/meta.
  - Fallback to local preview with error message if upload fails.

## 11) Webclip Flow
- URL stored in `contentText`.
- On demand/active state, fetch metadata and preview source.
- Persist fetched metadata (`previewUrl`, `pageTitle`, `lastFetched`) in `imageMeta`.

## Functional API Contract

This section defines behavior-level contracts the rebuild should preserve.

## Bootstrap and Spaces
- `GET /api/bootstrap?space=<uuid?>`
  - Returns either local/demo payload or cloud payload with spaces/items/camera.
- `POST /api/spaces`
  - Create top-level or child space (`parentSpaceId` optional).
- `PATCH /api/spaces/:spaceId`
  - Persist camera and/or mutable space fields.

## Items
- `GET /api/spaces/:spaceId/items`
  - List items for a space.
- `POST /api/spaces/:spaceId/items`
  - Create item with validated type and geometry/content defaults.
- `PATCH /api/items/:itemId`
  - Partial update for geometry/content/meta fields.
- `DELETE /api/items/:itemId`
  - Delete one item.

## Links
- `GET /api/items/:itemId/links`
  - Resolved incoming/outgoing links.
- `POST /api/item-links`
  - Insert a link edge (dedupe safe).
- `POST /api/item-links/sync`
  - Replace outgoing links for source item to match editor-derived targets.

## Graph/Search
- `GET /api/spaces/:spaceId/graph`
  - Return graph nodes and edges in that space.
- `GET /api/search?spaceId=&q=&mode=fts|semantic|hybrid`
  - Return ranked results.

## Media
- `POST /api/upload/presign`
  - Return upload URL/public URL/key for direct object upload.
- `POST /api/webclip/preview`
  - Return OG/screenshot/title metadata.

## Read-Only Utility API
- `GET /api/v1/items?space_id=...`
- `GET /api/v1/items/:itemId`

## Keyboard and Interaction Requirements

Must preserve platform-aware key behavior (Ctrl on Windows/Linux, Cmd on macOS).

Required shortcuts:
- Cmd/Ctrl+K: open/toggle command palette.
- Cmd/Ctrl+Z: undo.
- Shift+Cmd/Ctrl+Z: redo.
- Cmd/Ctrl+S: stack selected items.
- Delete/Backspace: delete selected items.
- Arrow keys: nudge single selected item.
- Shift+Arrow: larger nudge.
- Alt+Shift+Arrow: navigate/select nearest item in direction and center camera.

## Performance and Reliability Requirements

- Debounce network writes:
  - Camera: ~500ms.
  - Item patches: ~450ms.
  - Link sync: ~700ms.
  - Search requests: ~300ms.
- Render optimization:
  - Viewport culling for offscreen cards.
- Graceful degradation:
  - If cloud services unavailable, local mode remains fully usable for core editing.
- Input validation:
  - API validates payloads and constrains geometry/zoom ranges.

## State Management Requirements

Store must track at minimum:
- Active space ID.
- Camera state.
- Item dictionary keyed by id.
- Selection state and lasso state.
- Drag/resize interaction state.
- Snap toggle.
- Undo/redo stacks.
- Scratch pad open state.
- Canvas tool mode.

## Rebuild Guidance (Efficiency-Oriented)

To rebuild faster on a new UI:
- Keep existing API contracts and data shapes stable first.
- Implement headless domain modules before rendering:
  - Canvas state engine.
  - Item CRUD adapters.
  - Link extraction/sync adapter.
  - Search adapter.
- Build local/cloud adapters behind one persistence interface.
- Reuse current semantic boundaries:
  - bootstrap orchestration
  - item persistence scheduler
  - editor-to-link sync pipeline
  - import/export serialization
- Treat current visual components as replaceable shells around these behaviors.

## Known Functional Gaps in Current App (Optional Improvement Targets)

- Focus mode trigger plumbing exists in parts of canvas code but is not fully wired from app shell.
- `canvasTool` has state support but limited end-to-end usage from controls.
- Connection-lines utility exists; verify full mount/wiring in final composition.
- Undo does not comprehensively capture all patch-based content edits.

These are good opportunities to improve during rebuild while preserving compatibility.

## Acceptance Checklist for Rebuild

- [ ] User can fully operate canvas in local mode without backend.
- [ ] Cloud mode bootstraps and persists camera/items correctly.
- [ ] All item types can be created/edited/deleted and persisted.
- [ ] Internal links can be authored and resolved in backlinks.
- [ ] Search modes function with correct fallbacks.
- [ ] Space/folder hierarchy workflow functions end-to-end.
- [ ] Import/export round trip works for camera + items.
- [ ] Image and webclip workflows function with failure fallbacks.
- [ ] Required keyboard shortcuts work cross-platform.
- [ ] API contracts are backward-compatible with existing consumers.

## Canonical Functional References in Current Codebase

- App orchestration: `app/_components/VigilApp.tsx` → **`ArchitecturalCanvasApp`**
- Canvas shell + graph state: `src/components/foundation/ArchitecturalCanvasApp.tsx`, `architectural-types.ts`, `architectural-db-bridge.ts`, `architectural-neon-api.ts`
- API/DB item shape (mapper): `src/model/canvas-types.ts`, `src/lib/item-mapper.ts`
- Note bodies: TipTap inside **`ArchitecturalNodeCard`** / focus editor paths in the same shell
- Links inspector + wiki targets in HTML: `src/components/ui/ArchitecturalLinksPanel.tsx`
- Bootstrap + space resolution: `app/api/bootstrap/route.ts`, `src/lib/spaces.ts`
- Items/spaces routes: `app/api/spaces/[spaceId]/items/route.ts`, `app/api/items/[itemId]/route.ts`, `app/api/spaces/[spaceId]/route.ts`
- Links/backlinks routes: `app/api/items/[itemId]/links/route.ts`, `app/api/item-links/sync/route.ts`
- Search (FTS / hybrid lexical): `app/api/search/route.ts`; embedding cleanup: `src/lib/item-embedding.ts`
- Graph route: `app/api/spaces/[spaceId]/graph/route.ts`
- Upload/webclip routes: `app/api/upload/presign/route.ts`, `app/api/webclip/preview/route.ts`

