# VIGIL — Engineering strategy (living)

This file is the **short bridge** between the repo today and the full product spec. The spec is **`docs/VIGIL_MASTER_PLAN.md`** (canonical copy of the user’s master document).

## Review summary (master plan)

- **Product:** Personal infinite canvas (Spatial-inspired): notes, stickies, images, folders, stacks, clips, TTRPG lore later. **Single user, no auth.**
- **Stack target:** Next.js App Router + React, **custom DOM canvas** (CSS `transform` pan/zoom, no `<canvas>`), **@use-gesture/react**, **framer-motion**, **zustand + immer**, **TipTap**, **Tailwind 4**, **Drizzle + Neon + R2 + OpenAI** where needed.
- **Explicit non-goals:** **No tldraw** (or any licensed whiteboard SDK). **No Auth.js / OAuth.**
- **Data model:** Items are the source of truth on the server; `spaces.canvas_state` holds **camera only** `{ x, y, zoom }`. Schema includes `item_links`, `item_embeddings` (pgvector), stacks (`stack_id` / `stack_order`). **No `users` table** in the Drizzle schema.

## Current repo vs target (honest delta)

| Area | Today (`vigil/`) | Target (master plan) |
|------|------------------|----------------------|
| Canvas | **tldraw removed** | **`VigilCanvas`** + CSS transform layer + item cards |
| Persistence | **`items`** + camera in **`spaces.canvas_state`** | Same; legacy DB rows may still hold old `canvas_state` until migrated |
| State | **zustand** + immer (`canvas-store`) | Same; **select stable slices** (e.g. `s.items`), derive arrays with `useMemo`—never return `Object.values(s.items)` from a selector (avoids infinite re-renders / `getServerSnapshot` issues) |
| Motion | **framer-motion** + @use-gesture | Same per plan presets |
| Styling | **Tailwind 4** + CSS variables / tokens | Visual Design Bible polish (Phases 6–7) |
| Cross-card links | TipTap `vigil:item:` links + **`/api/item-links/sync`**; link picker when note is active | **`[[` trigger** UX polish; graph views (Phase 5) |
| Import / export | Toolbar **Export JSON** / **Import JSON**; cloud import creates items via API | Preferences, richer conflict rules |
| PWA | **`public/sw.js`** + **`RegisterSw`** (prod register, minimal SW) | Offline caching strategy when needed |
| License risk | Resolved (no tldraw) | **MIT-only** surface area |

## Strategic decision

We **adopt the master plan as source of truth** for architecture and phases. The existing tldraw-based implementation is a **spike / prototype**: it validated Neon + API shape + UX ideas but **does not match** licensing and product goals.

**Status:** Phases **1–4** are largely in-repo (canvas interactions, TipTap, FTS + Cmd+K with **Keywords / Meaning / Both** via `/api/search?mode=`, embeddings API, MCP). Remaining emphasis: **Phase 5+** (TTRPG depth, graph), **R2 presign** hardening, **performance culling**, and polish per master plan.

## Phase map (use for roadmaps and todos)

| Plan phase | Focus |
|------------|--------|
| **1** | Foundation: DOM canvas, camera, Note/Sticky cards, gestures, Drizzle/Neon, spaces, R2 prep |
| **2** | Selection, resize, snap guides, undo/redo, stacks, folders→space zoom, context menu, DnD |
| **3** | TipTap in notes, images, checklists, web clips, scratch pad |
| **4** | FTS, Cmd+K, `[[` links, embeddings, REST v1, MCP |
| **5** | TTRPG entities, graph, consistency, timeline |
| **6** | Visual polish (shadows, folder sheen, transitions) |
| **7** | Typography & micro-detail |
| **8** | Performance (culling), PWA, import/export, preferences |

## Environment / cost notes

- Master plan assumes **$0 recurring** on free tiers; **OpenAI embeddings** are usage-based (typically small).
- **Legacy DBs:** If older rows still have full tldraw JSON in `canvas_state`, migrate or reset the dev DB to match the current Drizzle schema (camera-only `canvas_state`).

## For agents / contributors

1. Read **`docs/VIGIL_MASTER_PLAN.md`** for visuals, gestures, springs, and phase detail.
2. Prefer code that follows the custom-canvas architecture; **tldraw is gone** from this repo.
3. **Zustand:** Subscribe to **stable references** from the store (e.g. `s.items`). Use `useMemo` to derive `Object.values(items)` in the component. Do **not** use selectors that allocate a new array/object every render.
4. When touching schema, align migrations with **`src/db/schema.ts`** and the master plan (stacks, search, embeddings, links).
