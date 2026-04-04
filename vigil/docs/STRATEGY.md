# heartgarden — Engineering strategy (living)

This file is the **short bridge** between the repo today and planning docs. **Task order for the lore vertical** (Phases A–D, UX2): Cursor plan `heartgarden_lore_engine_7fc1fb56.plan.md` (`.cursor/plans/`). **Repo-wide shipped vs next:** **`docs/BUILD_PLAN.md`**. **Index:** **`docs/HEARTGARDEN_MASTER_PLAN.md`**. **Historical product bible** (dated paths): **`docs/archive/vigil-master-plan-legacy.md`** — stub at **`docs/VIGIL_MASTER_PLAN.md`**.

## Review summary (master plan)

- **Product:** Personal infinite canvas (Spatial-inspired): notes, stickies, images, folders, stacks, clips, TTRPG lore later. **Single user, no auth.**
- **Stack target:** Next.js App Router + React, **custom DOM canvas** (CSS `transform` pan/zoom, no `<canvas>`), **@use-gesture/react**, **framer-motion**, **zustand + immer**, **TipTap**, **Tailwind 4**, **Drizzle + Neon + R2 + OpenAI** where needed.
- **Explicit non-goals:** **No tldraw** (or any licensed whiteboard SDK). **No Auth.js / OAuth.**
- **Data model:** Items are the source of truth on the server; `spaces.canvas_state` holds **camera only** `{ x, y, zoom }`. Schema includes `item_links`, `item_embeddings` (pgvector), stacks (`stack_id` / `stack_order`). **No `users` table** in the Drizzle schema.

## Current repo vs target (honest delta)

| Area | Today (`vigil/`) | Target (master plan) |
|------|------------------|----------------------|
| Canvas | **tldraw removed**; **production shell = `ArchitecturalCanvasApp`** (`src/components/foundation/`) | Custom DOM + CSS transform layer + item cards (same intent as plan’s `VigilCanvas`) |
| Persistence | **`items`** + camera in **`spaces.canvas_state`**; Neon **bootstrap + CRUD bridge** for architectural graph when not in demo mode | Same; legacy DB rows may still hold old `canvas_state` until migrated |
| State | **Primary graph:** React state inside `ArchitecturalCanvasApp`. **Also:** **zustand** `canvas-store` for some **panels** (backlinks, timeline, etc.) — **dual stack until unified** | Plan: zustand + immer; **select stable slices**, derive arrays with `useMemo`—never return `Object.values(s.items)` from a selector (avoids infinite re-renders / `getServerSnapshot` issues) |
| Motion | **framer-motion** + @use-gesture | Same per plan presets |
| Styling | **Tailwind 4** + tokens; **Geist** + **Lora** (headings in editor); Vercel-ish neutrals + card tokens; chips/glass via `vigil-ui-classes` | Visual Design Bible polish + `VISUAL_REVAMP_PLAN` (icons, grouping) |
| Cross-card links | TipTap `vigil:item:` links + **`/api/item-links/sync`**; **`[[` picker**; **Links** panel resolves `[[` / vigil links from note **content** on **local canvas** (no Neon); cloud uses **`item_links`** API; **Graph** overlay (**d3-force**, **Reset layout**, **drag to reheat**) via **`GET /api/spaces/[id]/graph`**; note **formatting toolbar** + underline/highlight | LLM auto-linking, deeper graph UX (Phase 5) |
| Lore / LLM (v1) | **`POST /api/lore/query`** — FTS (+ fuzzy) retrieval + **Anthropic** synthesis; **`LoreAskPanel`** from Cmd+K **Ask lore (AI)** | Phase 5 consistency checker, bulk import, auto-link; optional streaming / citations UX |
| Save confidence | **Status bar** sync line (`neon-sync-bus` + wrapped Neon API calls + debounced note pending); documents undo vs server in UI | Optional: canvas **version history** / snapshots (`BUILD_PLAN.md` UX2) |
| TTRPG | **Entity type** bar + **`entity_meta`** fields per type; **Timeline** panel (Event + `eventDate`) | Markdown LLM import, consistency checker, richer forms |
| Import / export | Toolbar **Export** / **Import** (JSON); cloud import creates items via API | Preferences, richer conflict rules |
| PWA | **`public/sw.js`** + **`RegisterSw`** (prod register, minimal SW) | Offline caching strategy when needed |
| R2 images | **Presigned PUT** at **`/api/upload/presign`** + env in `.env.local.example` | Bucket policy, CORS, optional image transforms |
| Performance | **Viewport culling** (visible entity lists in **`ArchitecturalCanvasApp`**), lazy **`img`** decoding | Broader memoization / virtualize if 500+ cards on screen |
| E2E / visual | **Playwright** on **:3001** (`next start` + `PLAYWRIGHT_E2E` bootstrap), smoke + screenshot shell | Expand flows (notes, graph, palette), CI job |
| License risk | Resolved (no tldraw) | **MIT-only** surface area |

## Strategic decision

We **treat the archived master plan** as **historical product intent** (gestures, phases, feel), not as accurate file paths. **Execution SoT:** Cursor lore plan + **`BUILD_PLAN.md`**. The old tldraw spike validated Neon + API shape + UX ideas but **does not match** licensing and product goals.

**Status:** Phases **1–4** largely done in substance (including **Neon architectural bridge**, palette, search APIs, MCP). **Lore Q&A v1** (Anthropic + DB text retrieval) is **landed** — see **`docs/BUILD_PLAN.md`**. **Phase 5:** entity meta, timeline, graph, local **Links** + **title mentions**, MCP tools (see `scripts/mcp-server.mjs`); LLM-heavy items remain (see **`docs/FOLLOW_UP.md`**). **Phase 6–7:** **Vercel-style spike** plus **wholesale visual revamp** (icons, toolbar grouping, palette/graph/scratch/panels) per **`docs/VISUAL_REVAMP_PLAN.md`** are largely landed; optional Spatial sheen / motion and type-scale audit remain nice-to-haves. **Phase 8:** culling + PWA shell + export/import; deeper prefs/minimap/offline caching still open (**`docs/FOLLOW_UP.md`**).

**After UX / seed / stacking fixes:** Re-run **`npm run check`** and any affected e2e; the **phase map is unchanged** — updates belong in **`BUILD_PLAN.md`** when you close a tranche.

## Phase map (use for roadmaps and todos)

| Plan phase | Focus |
|------------|--------|
| **1** | Foundation: DOM canvas, camera, Note/Sticky cards, gestures, Drizzle/Neon, spaces, R2 prep |
| **2** | Selection, resize, snap guides, undo/redo, stacks, folders→space zoom, context menu, DnD |
| **3** | TipTap in notes, images, checklists, web clips, scratch pad |
| **4** | FTS, Cmd+K, `[[` links, embeddings, REST v1, MCP |
| **4b** *(execution)* | **Neon architectural persistence bridge** + **lore query v1** (Anthropic) — tracked in **`BUILD_PLAN.md`** |
| **5** | TTRPG entities, graph, consistency, timeline |
| **6** | Visual polish (shadows, folder sheen, transitions) |
| **7** | Typography & micro-detail |
| **8** | Performance (culling), PWA, import/export, preferences |

## Environment / cost notes

- Master plan assumes **$0 recurring** on free tiers; **OpenAI embeddings** are usage-based (typically small). **Anthropic** is usage-based for **`/api/lore/query`** and any future Claude features.
- **Legacy DBs:** If older rows still have full tldraw JSON in `canvas_state`, migrate or reset the dev DB to match the current Drizzle schema (camera-only `canvas_state`).

## Visual overhaul roadmap

**Vercel-style spike** (Geist, neutral tokens, card surfaces, canvas dot grid) lives in `app/globals.css`, `layout.tsx`, `CanvasItemView`, `VigilCanvas`, `card-shadows.ts`, `vigil-ui-classes.ts`. **Wholesale polish** (Lucide, `VigilMainToolbar`, command palette / graph / scratch / side panels, TipTap format bar) is implemented; **`docs/VISUAL_REVAMP_PLAN.md`** tracks optional follow-ups (motion/sheen, type scale, flower picker).

## For agents / contributors

1. For **next tasks:** Cursor lore plan + **`docs/BUILD_PLAN.md`**. For **historical UX / session ordering:** **`docs/archive/vigil-master-plan-legacy.md`** (cross-check paths against real code).
2. Prefer code that follows the custom-canvas architecture (**`ArchitecturalCanvasApp`**); **tldraw is gone** from this repo.
3. **Zustand:** Subscribe to **stable references** from the store (e.g. `s.items`). Use `useMemo` to derive `Object.values(items)` in the component. Do **not** use selectors that allocate a new array/object every render.
4. When touching schema, align migrations with **`src/db/schema.ts`** and the master plan (stacks, search, embeddings, links).
