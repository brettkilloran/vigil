---
name: Dock create snappy
overview: Create-from-dock works but feels slow in Neon/cloud mode because the UI waits for HTTP before painting a new card. Make creation feel instant via optimistic graph updates, then reconcile server IDs; keep error surfacing if persist fails.
todos:
  - id: optimistic-content-create
    content: "In createNewNode (Neon path): synchronously add a local entity with createId() + same fields as today, setGraph immediately; then apiCreateItem in background; on success replace/map to server id + persistedItemId + updatedAt; on failure remove entity and notify user"
  - id: optimistic-folder-create
    content: "Folders need apiCreateSpace then apiCreateItem (two hops). Either add optimistic folder+temp childSpace placeholder with reconciliation, or document deferral and at minimum parallelize nothing extra—scope note/task/code/media first for max impact"
  - id: undo-reconcile
    content: "Ensure recordUndoBeforeMutation + undo/redo behave with optimistic creates (snapshot before local add; undo removes phantom; redo may need same optimistic pattern or skip—match existing graph undo semantics)"
  - id: api-failure-ux
    content: "On apiCreateItem/apiCreateSpace failure after optimistic add, rollback graph and surface error (neon-sync-bus or alert) so users never see a stuck ghost card"
  - id: optional-stack-modal-css
    content: "Optional follow-up: narrow .viewportStackModalOpen pointer-events to .viewportSceneLayer only so dock stays clickable with stack open (separate from latency)"
---

# Snappy dock create (Neon / cloud)

## Revised problem

Creation **works** but takes a **long time** to show up. Users expect dock create to feel **instant**, like local demo mode.

## Root cause (code)

In [`heartgarden/src/components/foundation/ArchitecturalCanvasApp.tsx`](heartgarden/src/components/foundation/ArchitecturalCanvasApp.tsx), when `persistNeonRef.current && isUuidLike(activeSpaceId)`:

- **Content nodes** (note, task, code, media): the handler starts an async IIFE, **`await apiCreateItem(...)`**, and only then calls `setGraph` to insert the entity (see ~4755–4785). Until the network returns, **nothing new appears on the canvas**.
- **Folders**: **`await apiCreateSpace`** then **`await apiCreateItem`** — two sequential round trips before any `setGraph` (~4656–4705).

Local / non-persist path (same function, after the early `return` from the async branch) uses `createId()` and **immediate** `setGraph` — that path is snappy.

So the regression is **perceived latency from server-first persistence**, not missing `onClick`.

## Direction: optimistic UI + reconciliation

1. **Content types (highest impact)**  
   - Right after `recordUndoBeforeMutation()` and layout math (same `x`, `y`, `nextZ`, `bodyHtml`, etc.), **synchronously** push a `CanvasContentEntity` (or equivalent) into `graph.entities` and `spaces[spaceId].entityIds` using a **client `createId()`** (or existing id factory).  
   - Fire `apiCreateItem` **without awaiting before paint**.  
   - **Success**: map server row to entity shape (`canvasItemToEntity`), **replace** the optimistic id with the real UUID in `entities` and `entityIds` (and set `persistedItemId` / `itemServerUpdatedAtRef` like today). Any code that held the old id in selection may need a quick remap.  
   - **Failure**: **remove** the optimistic entity from graph + space list; show a clear error (reuse sync strip / `neon-sync-bus` if available, else minimal alert).

2. **Folders (two-step server dependency)**  
   - Harder to fake `childSpaceId` without a server response. Options:  
     - **Phase 1**: only optimize content types; folders stay two-hop but could still show a “creating…” state or a single combined API later.  
     - **Phase 2**: optimistic folder with a **temporary** `childSpaceId` (client uuid) and replace graph subtree when `apiCreateSpace` returns — higher risk; needs careful reconciliation and Neon invariants.

3. **Undo / redo**  
   - `recordUndoBeforeMutation()` already runs at the start of `createNewNode`. Confirm the snapshot is **before** the optimistic insert (it should be).  
   - Undo after create should remove the card whether it is still optimistic or already reconciled (same as today for local creates).  
   - Redo: ensure redo replay does not double-post to API without an explicit design (may need to treat optimistic create like local-only in history until persisted — **audit** `ArchitecturalUndoSnapshot` usage for creates).

4. **Double-submit / spam**  
   - Consider ignoring rapid duplicate creates or disabling create buttons while an optimistic row is inflight per type (optional polish).

## Out of scope / optional

- **Stack modal + dock**: Earlier analysis: `.viewportStackModalOpen { pointer-events: none }` on the whole `.viewport` blocks in-viewport chrome. If product wants dock usable while stack is open, narrow that rule to `.viewportSceneLayer` only in [`ArchitecturalCanvasApp.module.css`](heartgarden/src/components/foundation/ArchitecturalCanvasApp.module.css). This is **orthogonal** to latency.

## Verification

- Neon workspace: click Note/Task/Code/Media — card should **appear immediately**; after a short delay, id should match server (no duplicate, selection stable).  
- Throttle network in DevTools — failure path removes ghost card and shows error.  
- Undo immediately after create — card disappears; no orphan server row without a deliberate “commit on undo” policy (document actual behavior after implementation).

## Key files

- [`heartgarden/src/components/foundation/ArchitecturalCanvasApp.tsx`](heartgarden/src/components/foundation/ArchitecturalCanvasApp.tsx) — `createNewNode`  
- [`heartgarden/src/components/foundation/architectural-neon-api.ts`](heartgarden/src/components/foundation/architectural-neon-api.ts) (or wherever `apiCreateItem` / `apiCreateSpace` live) — no change required unless batching helps  
- [`heartgarden/src/lib/neon-sync-bus.ts`](heartgarden/src/lib/neon-sync-bus.ts) — optional error surfacing
