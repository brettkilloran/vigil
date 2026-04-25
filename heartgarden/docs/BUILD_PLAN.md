---
title: heartgarden — architecture snapshot + shipped history
status: canonical
audience: [agent, human]
last_reviewed: 2026-04-23
canonical: true
related:
  - heartgarden/docs/BACKLOG.md
  - heartgarden/docs/FEATURES.md
  - heartgarden/docs/CODEMAP.md
  - heartgarden/docs/LORE_ENGINE_ROADMAP.md
---

# heartgarden — architecture snapshot + shipped history

This file is the **architecture snapshot** and **shipped-tranches history** for the heartgarden app. It is **not** the backlog any more.

**Open backlog (SOT):** [`docs/BACKLOG.md`](./BACKLOG.md) — hardening, parity, features, review overflow. All `/backlog` writes land there.

**Other canonical docs:**

- **Lore vertical overview:** [`docs/LORE_ENGINE_ROADMAP.md`](./LORE_ENGINE_ROADMAP.md)
- **Execution plans** (optional engineering notes, YAML todos): [`.cursor/plans/README.md`](../../.cursor/plans/README.md)
- **Historical product bible:** `docs/archive/vigil-master-plan-legacy.md` (stub at `VIGIL_MASTER_PLAN.md` redirects there)
- **Engineering delta:** `STRATEGY.md`
- **Human / account / infra:** `FOLLOW_UP.md`
- **Deploy / release gates:** `GO_LIVE_REMAINING.md`

## Architecture snapshot (verify after each large merge)

| Layer | Location / notes |
|--------|------------------|
| **Production canvas shell** | `ArchitecturalCanvasApp` + `src/components/foundation/*` — mounted from `app/_components/VigilApp.tsx`. |
| **Boot + session gate (default scenario)** | `VigilAppBootScreen` + `canvasSessionActivated` / `bootLayerDismissed`; `technicalViewportReady` vs `viewportRevealReady` (bootstrap + surface ready; activation required before full chrome). Optional boot flowers (`VigilBootFlowerGarden` portaled under the overlay stack). |
| **Flow / nav visuals (optional)** | When **canvas effects** are on: `VigilFlowRevealOverlay` via **`next/dynamic`** (`ssr: false`) from `src/components/transition-experiment/` — full-viewport **raw WebGL** shader (FBM “liquid” edge + digital-glitch pass), no `three` / `gsap`. Drives `u_progress` from `sessionActivated`, `navTransitionActive`, and `bootstrapPending`. **Off:** overlay unmounted; **space changes** skip timed nav dimming (instant `enterSpace`). `prefers-reduced-motion: reduce` → overlay returns `null`. |
| **Canvas performance (scale)** | **`src/lib/canvas-viewport-cull.ts`** — viewport culling for entity DOM, collapsed stacks, and connections (SVG + rope **rAF**). Media: **`heartgarden-image-display-url.ts`** + optional **`NEXT_PUBLIC_HEARTGARDEN_IMAGE_URL_TEMPLATE`**. Bundle: **`pnpm run analyze`**. |
| **Space nav timing (effects on)** | `enterSpace` sets `navTransitionActive`; scene layer uses `viewportSceneLayerDimmed` until fetch + `VIEWPORT_SCENE_FADE_MS` / `VIEWPORT_TRANSITION_CENTER_MS` elide (see `ArchitecturalCanvasApp.tsx`). A **generation counter** drops stale async completions when the user navigates again before the prior fetch finishes; optional future work: cancel in-flight fetch or a CSS-only nav cue when effects are **off**. |
| **Suspense shell** | `app/page.tsx` — dark `#0c0c0e` fallback to reduce flash before client boot UI. |
| **Graph state** | In-component React state + **undo/redo** stack (`architectural-undo.ts`); Neon sync via `architectural-db-bridge.ts`, `architectural-neon-api.ts`, `/api/bootstrap`, item/space routes. |
| **Save / sync indicator** | `neon-sync-bus.ts` + instrumented `architectural-neon-api.ts` + debounced note body bumps. Status strip in **`ArchitecturalStatusBar`**: Loading → Local (demo) → Saving… → Saved / Sync error; optional **vault index** busy/error line via **`vault-index-status-bus.ts`**. Tooltips document **undo vs server** semantics. Delta sync **defers** interval polls while inline/focus is dirty or a PATCH is in flight; **`apiPatchItem`** serializes per-item PATCHes; optional **`NEXT_PUBLIC_HEARTGARDEN_SYNC_DEBUG=1`** logs PATCH timing — **`docs/API.md`**, **`docs/FEATURES.md`**. |
| **Canvas navigation aids** | **Minimap** (viewport metrics strip toggle), **fit / frame** helpers (`canvas-view-bounds.ts`), optional **viewport toast** (`CanvasViewportToast.tsx`). See **`docs/FEATURES.md`**. |
| **Rich note editing** | **`BufferedContentEditable`** + **`[[` wiki link assist** (`WikiLinkAssistPopover.tsx`, `wiki-link-caret.ts`). |
| **Search** | Postgres FTS + trigram on `search_blob`. **`/api/search`**: `hybrid` / `semantic` use **RRF** of FTS + fuzzy + **pgvector** chunks when embeddings are configured (`src/lib/embedding-provider.ts`); `GET /api/search/chunks` returns raw chunk hits. **`/api/search/suggest`** remains prefix-FTS. |
| **Vault index** | `item_embeddings` stores **per-chunk** vectors (`space_id`, `chunk_index`, …). **`POST /api/items/[id]/index`** (re)chunks + Anthropic embeds **lore summary/aliases** (`lore-item-meta.ts`). Server **`after()`** path is the default owner (`schedule-vault-index-after.ts`); client debounced trigger in `architectural-neon-api.ts` is disabled by default when `NEXT_PUBLIC_HEARTGARDEN_INDEX_OWNER=server_after`. **`POST /api/spaces/[id]/reindex`** (MCP `write_key`) remains for backfill. Rate limits: `vault-index-rate-limit.ts`. |
| **Lore Q&A** | `POST /api/lore/query` — **hybrid retrieval** (`vault-retrieval.ts`) + **1-hop `item_links` neighbors**, synthesis via **Anthropic**. Same env + `lore-query-rate-limit.ts` as before. UI: **Ask lore** → `LoreAskPanel`. |
| **DB** | Drizzle `src/db/schema.ts`; Neon requires **`CREATE EXTENSION vector`** before push (`pnpm run db:ensure-pgvector`). |
| **Soft multiplayer (presence)** | Optional **`canvas_presence`** + `GET/POST /api/spaces/[spaceId]/presence` (subtree peer list by default). Client: `use-heartgarden-presence-heartbeat.ts`, `architectural-neon-api.ts`, remote cursors in `ArchitecturalRemotePresenceLayer.tsx`, emoji **follow** chips in `ArchitecturalStatusBar`. See **`docs/PLAYER_LAYER.md`** and **`docs/API.md`**. |

**Code / API maps:** **`docs/FEATURES.md`** (shipped capability index), **`docs/CODEMAP.md`** (where logic lives by feature), **`docs/API.md`** (route catalog). Update them when you ship a user-facing feature or a new API vertical.

**Health check:** From the app root (**`heartgarden/`** unless renamed — **`docs/NAMING.md`**), run `pnpm run check` (lint + production build). After UX / DB / stacking changes, run `pnpm run test:unit` and targeted `pnpm run test:e2e` if flows touched. **Neon vault schema:** `pnpm run db:vault-setup`; **embedding backfill:** app up + `pnpm run vault:reindex` (see **`docs/FOLLOW_UP.md`**).

---

## Completed tranches (plan remains valid)

These align with the **legacy** master plan phases 1–4 in substance (see **`docs/archive/vigil-master-plan-legacy.md`**), even where that doc still says `VigilCanvas` / `components/canvas/`.

| Tranche | Notes |
|---------|--------|
| Custom DOM surface (no tldraw) | Transform-based pan/zoom, cards, folders, stacks, connections. |
| Drizzle + Neon + pgvector | `spaces`, `items`, `item_links`, `item_embeddings`; self-FK on `spaces.parent_space_id`. |
| **Neon persistence bridge** | Bootstrap hydrate, create/patch/delete items & spaces; **viewport pan/zoom is browser-local** (not persisted to Neon by the shell — see **`docs/API.md`**); folder child spaces (Phase “A” in recent work). |
| Cmd+K palette | Local filter + `/api/search/suggest`, spaces, actions, recent items, export (action list expanded over time). |
| **Canvas minimap + fit** | Toggle map from viewport metrics; fit-to-content / fit-selection math shared via **`canvas-view-bounds.ts`**. |
| **Vault index status UI** | Status bar shows embedding/index busy + error state (event bus). |
| **`[[` wiki link assist** | Popover while typing wiki links in buffered rich text. |
| **Viewport culling + dynamic flow overlay** | Off-screen DOM skipped; **`VigilFlowRevealOverlay`** loaded with **`next/dynamic`** (`ssr: false`). |
| **Zoom-aware media URLs** | Optional **`NEXT_PUBLIC_HEARTGARDEN_IMAGE_URL_TEMPLATE`** for CDN-sized images on cards. |
| **Delta sync + space rows** | **`GET …/changes`** returns **`spaces`** patches for subtree reparents; the **shell** always requests **`includeItemIds=1`** so each poll carries the full subtree id list for tombstones (other clients may omit for lighter payloads — **`docs/API.md`**). |
| **Lore engine + vault retrieval** | `lore-engine.ts`, `vault-retrieval.ts`, `item-vault-index.ts`, `/api/lore/query`, `/api/search`, `/api/search/chunks`, index + reindex routes. Client: `LoreAskPanel`. |
| **Neon save indicator** | Live sync line in status bar; tracks in-flight mutations + debounced content patches. |
| **Soft presence + follow view** | Ephemeral **`canvas_presence`** rows; status bar collaborator chips + in-canvas remote pointers; **follow** applies peer camera / space (confirm if focus or stack UI is open). |
| CI / Storybook | `pnpm run check`; Storybook in CI per `AGENTS.md`. |

*Recent batches (UX, seed data, stacking, boot gate, optional WebGL flow overlay, canvas-effects toggle):* they refine the shell above and **do not invalidate** the master phase map—re-run checks and e2e smoke after merges.

---

## Open backlog → [`docs/BACKLOG.md`](./BACKLOG.md)

Open engineering work (near-term hardening, lore import tranche, mid / later phases, `NET_NEW` overflow from reviews, cross-cutting code-health pointers) lives in [`docs/BACKLOG.md`](./BACKLOG.md). That file is the single source of truth; this one is history + architecture only.

When a backlog item **ships**, add a row to the **Completed tranches** table above (brief line + commit ref if handy) and remove it from `BACKLOG.md`. Do not append new open work here.

<!-- backlog-moved: 2026-04-23 — §"Next execution phases" (Code health / Near-term / Lore import tranche / Mid-term / Later) migrated to docs/BACKLOG.md -->

---

## Legacy session list (`docs/archive/vigil-master-plan-legacy.md`)

The numbered **Sessions 1–38** there are **historical ordering guidance** only. Execution status is tracked **here**, in the **Cursor lore plan** (Phases B–D), and in **`STRATEGY.md`**.

### Stub at `VIGIL_MASTER_PLAN.md`

The path is kept so old links work; it redirects to **`docs/archive/vigil-master-plan-legacy.md`** for the full text. For *what to build next*, prefer the **Cursor plan** + this file.

---

*Living document — edit when shipping or reprioritizing.*
