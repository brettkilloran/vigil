# Players space: multiplayer hardening (living plan)

## Product decisions (locked in)

- **Co-editing:** Ship incremental sync + conflict handling first; **true simultaneous rich-text merge (CRDT/OT)** is a **later** phase.
- **Camera:** **No shared server camera.** Stop writing viewport to `spaces.canvas_state` (no multiplayer fighting over one row). **Browser-local persistence:** read/write pan+zoom in **`localStorage` keyed by `spaceId`** (e.g. `heartgarden-space-camera-v1` JSON map or one key per space). **First visit** to a space with no entry: use **`defaultCamera()`** — `{ x: 0, y: 0, zoom: 1 }` ([`heartgarden/src/model/canvas-types.ts`](heartgarden/src/model/canvas-types.ts)). **Folder drill:** child spaces are normal spaces; each gets its **own** key automatically. **Bootstrap `camera`:** **ignore** for setting the shell (or drop from API later); local entry wins after hydration.

This matches **shared PIN, no user accounts:** each **browser profile** remembers its own view; no login table required.

**Caveat:** Two tabs in the **same** browser share `localStorage`, so they share one saved camera per space—that is usually fine for one person; two people on one machine in two browsers still get separate views.

---

## Phase 1 — Local camera + remove DB camera writes

- **Remove** debounced [`apiPatchSpaceCamera`](heartgarden/src/components/foundation/architectural-neon-api.ts) from [`ArchitecturalCanvasApp.tsx`](heartgarden/src/components/foundation/ArchitecturalCanvasApp.tsx) (~2957).
- **Add** a tiny helper (new file under `heartgarden/src/lib/` or colocate): `readSpaceCamera(spaceId)`, `writeSpaceCamera(spaceId, camera)` with try/catch for quota/private mode.
- **Apply order:** After graph is ready for a given `activeSpaceId`, set translate/scale from **localStorage** for that id, else `defaultCamera()`. On pan/zoom (existing state updates), **debounce** writes to localStorage (~300–700ms, similar to current server debounce).
- **Space navigation:** When `activeSpaceId` changes (including into a folder child space), load camera for **that** id from localStorage or default.
- **API:** Ignore or reject `camera` on [`PATCH /api/spaces/[spaceId]`](heartgarden/app/api/spaces/[spaceId]/route.ts); stop persisting viewport server-side. Update **docs** ([`AGENTS.md`](heartgarden/AGENTS.md), [`docs/archive/FUNCTIONAL_PRD_REBUILD.md`](heartgarden/docs/archive/FUNCTIONAL_PRD_REBUILD.md) if still relevant, [`PLAYER_LAYER.md`](heartgarden/docs/PLAYER_LAYER.md) if needed): camera is **client-local**, not Neon.
- **DB:** `canvas_state` unused for camera going forward; no migration required for MVP.

## Phase 2 — Delta sync (unchanged intent)

- Short-interval **poll** (MVP) with `since` cursor; merge into graph; avoid full replace where possible.

## Phase 3 — Concurrency (unchanged intent)

- Optional `baseUpdatedAt` / 409, use PATCH response item, serialize per-item saves, focus-overlay rebase rules.

## Phase 4 — Presence (optional)

- Ephemeral awareness.

## Phase 5 — CRDT / hosted co-editing (later)

- Only if product requires live merged typing in one note.

---

## Testing

- **Multiplayer:** Two browsers (or two profiles): confirm **no** `PATCH` for camera; each keeps its own pan/zoom after refresh for the same player space.
- **Folders:** Enter child space, pan, reload: camera restores for **that** `spaceId`; root space has separate saved camera.
- **First visit:** Clear key → opens at `defaultCamera()`.
