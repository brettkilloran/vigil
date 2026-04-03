# VIGIL — Engineering strategy (living)

This file is the **short bridge** between the repo today and the full product spec. The spec is **`docs/VIGIL_MASTER_PLAN.md`** (canonical copy of the user’s master document).

## Review summary (master plan)

- **Product:** Personal infinite canvas (Spatial-inspired): notes, stickies, images, folders, stacks, clips, TTRPG lore later. **Single user, no auth.**
- **Stack target:** Next.js App Router + React, **custom DOM canvas** (CSS `transform` pan/zoom, no `<canvas>`), **@use-gesture/react**, **framer-motion**, **zustand + immer**, **TipTap**, **Tailwind 4**, **Drizzle + Neon + R2 + OpenAI** where needed.
- **Explicit non-goals:** **No tldraw** (or any licensed whiteboard SDK). **No Auth.js / OAuth.**
- **Data model:** Items are the source of truth on the server; `spaces.canvas_state` holds **camera only** `{ x, y, zoom }`. Plan adds `stack_id` / `stack_order`, generated `search_vector`, etc. **No `users` table** in the target schema (today’s repo still has one for legacy bootstrap—remove when migrating).

## Current repo vs target (honest delta)

| Area | Today (`vigil/`) | Target (master plan) |
|------|------------------|----------------------|
| Canvas | Was **tldraw** (removed) | **`VigilCanvas`** + CSS transform layer + item cards |
| Persistence | (legacy) tldraw snapshot + `source_shape_id` | **`items`** as source of truth; **`spaces.canvas_state`** = camera `{x,y,zoom}` only |
| State | React local state + refs | **zustand** + immer for canvas/items |
| Motion | Custom spring helper + some framer patterns | **framer-motion** springs per plan presets |
| Styling | Global CSS + inline toolbar | **Tailwind 4** + design tokens from Visual Design Bible |
| License risk | tldraw production key or watermarks | **MIT-only** surface area |

## Strategic decision

We **adopt the master plan as source of truth** for architecture and phases. The existing tldraw-based implementation is a **spike / prototype**: it validated Neon + API shape + UX ideas but **does not match** licensing and product goals.

**Status:** Phase 1 foundation is implemented in-repo (custom canvas + items API). Continue with master plan Phases 2–8 (polish, R2, advanced search, TTRPG depth, PWA).

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
- **Legacy DBs:** If you still have `users`, `source_shape_id`, or full tldraw JSON in `canvas_state`, run a manual migration or reset the dev database to match the current Drizzle schema.

## For agents / contributors

1. Read **`docs/VIGIL_MASTER_PLAN.md`** for visuals, gestures, springs, and phase detail.
2. Prefer **new code** that follows the custom-canvas architecture; avoid extending tldraw except for critical fixes before the cutover.
3. When touching schema, **drift toward** the master plan SQL (drop `users`, slim `canvas_state`, add stacks/search columns as migrations).
