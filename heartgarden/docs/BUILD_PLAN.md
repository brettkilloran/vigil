---
title: heartgarden — execution build plan
status: canonical
audience: [agent, human]
last_reviewed: 2026-04-13
canonical: true
related:
  - heartgarden/docs/FEATURES.md
  - heartgarden/docs/CODEMAP.md
  - heartgarden/docs/LORE_ENGINE_ROADMAP.md
---

# heartgarden — execution build plan (living)

This is the **repo-wide checklist**: architecture snapshot, shipped tranches, and backlog (hardening, embeddings, e2e, later phases). **Lore vertical** work (import pipeline, link phases, MCP expansion) is summarized in **`docs/LORE_ENGINE_ROADMAP.md`**; detailed notes live in **`.cursor/plans/README.md`** (index of workspace plans). Reprioritize here vs ad-hoc plans as needed.

**Historical product bible** (Spatial-style sessions, old paths): **`docs/archive/vigil-master-plan-legacy.md`**. Stub at **`VIGIL_MASTER_PLAN.md`** points there. Honest engineering delta: **`STRATEGY.md`**. Human / account items: **`FOLLOW_UP.md`**.

## Architecture snapshot (verify after each large merge)

| Layer | Location / notes |
|--------|------------------|
| **Production canvas shell** | `ArchitecturalCanvasApp` + `src/components/foundation/*` — mounted from `app/_components/VigilApp.tsx`. |
| **Boot + session gate (default scenario)** | `VigilAppBootScreen` + `canvasSessionActivated` / `bootLayerDismissed`; `technicalViewportReady` vs `viewportRevealReady` (bootstrap + surface ready; activation required before full chrome). Optional boot flowers (`VigilBootFlowerGarden` portaled under the overlay stack). |
| **Flow / nav visuals (optional)** | When **canvas effects** are on: `VigilFlowRevealOverlay` via **`next/dynamic`** (`ssr: false`) from `src/components/transition-experiment/` — full-viewport **raw WebGL** shader (FBM “liquid” edge + digital-glitch pass), no `three` / `gsap`. Drives `u_progress` from `sessionActivated`, `navTransitionActive`, and `bootstrapPending`. **Off:** overlay unmounted; **space changes** skip timed nav dimming (instant `enterSpace`). `prefers-reduced-motion: reduce` → overlay returns `null`. |
| **Canvas performance (scale)** | **`src/lib/canvas-viewport-cull.ts`** — viewport culling for entity DOM, collapsed stacks, and connections (SVG + rope **rAF**). Media: **`heartgarden-image-display-url.ts`** + optional **`NEXT_PUBLIC_HEARTGARDEN_IMAGE_URL_TEMPLATE`**. Bundle: **`npm run analyze`**. |
| **Space nav timing (effects on)** | `enterSpace` sets `navTransitionActive`; scene layer uses `viewportSceneLayerDimmed` until fetch + `VIEWPORT_SCENE_FADE_MS` / `VIEWPORT_TRANSITION_CENTER_MS` elide (see `ArchitecturalCanvasApp.tsx`). A **generation counter** drops stale async completions when the user navigates again before the prior fetch finishes; optional future work: cancel in-flight fetch or a CSS-only nav cue when effects are **off**. |
| **Suspense shell** | `app/page.tsx` — dark `#0c0c0e` fallback to reduce flash before client boot UI. |
| **Graph state** | In-component React state + **undo/redo** stack (`architectural-undo.ts`); Neon sync via `architectural-db-bridge.ts`, `architectural-neon-api.ts`, `/api/bootstrap`, item/space routes. |
| **Save / sync indicator** | `neon-sync-bus.ts` + instrumented `architectural-neon-api.ts` + debounced note body bumps. Status strip in **`ArchitecturalStatusBar`**: Loading → Local (demo) → Saving… → Saved / Sync error; optional **vault index** busy/error line via **`vault-index-status-bus.ts`**. Tooltips document **undo vs server** semantics. Delta sync **defers** interval polls while inline/focus is dirty or a PATCH is in flight; **`apiPatchItem`** serializes per-item PATCHes; optional **`NEXT_PUBLIC_HEARTGARDEN_SYNC_DEBUG=1`** logs PATCH timing — **`docs/API.md`**, **`docs/FEATURES.md`**. |
| **Canvas navigation aids** | **Minimap** (viewport metrics strip toggle), **fit / frame** helpers (`canvas-view-bounds.ts`), optional **viewport toast** (`CanvasViewportToast.tsx`). See **`docs/FEATURES.md`**. |
| **Rich note editing** | **`BufferedContentEditable`** + **`[[` wiki link assist** (`WikiLinkAssistPopover.tsx`, `wiki-link-caret.ts`). |
| **Search** | Postgres FTS + trigram on `search_blob`. **`/api/search`**: `hybrid` / `semantic` use **RRF** of FTS + fuzzy + **pgvector** chunks when embeddings are configured (`src/lib/embedding-provider.ts`); `GET /api/search/chunks` returns raw chunk hits. **`/api/search/suggest`** remains prefix-FTS. |
| **Vault index** | `item_embeddings` stores **per-chunk** vectors (`space_id`, `chunk_index`, …). **`POST /api/items/[id]/index`** (re)chunks + Anthropic embeds **lore summary/aliases** (`lore-item-meta.ts`). Server **`after()`** path is the default owner (`schedule-vault-index-after.ts`); client debounced trigger in `architectural-neon-api.ts` is disabled by default when `NEXT_PUBLIC_HEARTGARDEN_INDEX_OWNER=server_after`. **`POST /api/spaces/[id]/reindex`** (MCP `write_key`) remains for backfill. Rate limits: `vault-index-rate-limit.ts`. |
| **Lore Q&A** | `POST /api/lore/query` — **hybrid retrieval** (`vault-retrieval.ts`) + **1-hop `item_links` neighbors**, synthesis via **Anthropic**. Same env + `lore-query-rate-limit.ts` as before. UI: **Ask lore** → `LoreAskPanel`. |
| **DB** | Drizzle `src/db/schema.ts`; Neon requires **`CREATE EXTENSION vector`** before push (`npm run db:ensure-pgvector`). |
| **Soft multiplayer (presence)** | Optional **`canvas_presence`** + `GET/POST /api/spaces/[spaceId]/presence` (subtree peer list by default). Client: `use-heartgarden-presence-heartbeat.ts`, `architectural-neon-api.ts`, remote cursors in `ArchitecturalRemotePresenceLayer.tsx`, emoji **follow** chips in `ArchitecturalStatusBar`. See **`docs/PLAYER_LAYER.md`** and **`docs/API.md`**. |

**Code / API maps:** **`docs/FEATURES.md`** (shipped capability index), **`docs/CODEMAP.md`** (where logic lives by feature), **`docs/API.md`** (route catalog). Update them when you ship a user-facing feature or a new API vertical.

**Health check:** From the app root (**`heartgarden/`** unless renamed — **`docs/NAMING.md`**), run `npm run check` (lint + production build). After UX / DB / stacking changes, run `npm run test:unit` and targeted `npm run test:e2e` if flows touched. **Neon vault schema:** `npm run db:vault-setup`; **embedding backfill:** app up + `npm run vault:reindex` (see **`docs/FOLLOW_UP.md`**).

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
| CI / Storybook | `npm run check`; Storybook in CI per `AGENTS.md`. |

*Recent batches (UX, seed data, stacking, boot gate, optional WebGL flow overlay, canvas-effects toggle):* they refine the shell above and **do not invalidate** the master phase map—re-run checks and e2e smoke after merges.

---

## Next execution phases (ordered)

### Code health backlog (living audit)

**Cross-cutting bug / perf / hygiene backlog:** [`CODE_HEALTH_AUDIT_2026-04-21.md`](./CODE_HEALTH_AUDIT_2026-04-21.md) — dated audit with 45 prioritized items (CRITICAL → LOW) and a three-week attack order. Work those items alongside the phase tranches below; they are not duplicated here to avoid drift. Strike items out in the audit doc as they land. **2026-04-21:** first remediation batch landed (CRITICAL blockers + key HIGH items — see audit doc strikethroughs; changelog commits `38ca04a` / `bad55f2`). **2026-04-21 (batch 2 A-D):** landed observability/opaque-MCP fixes, subtree/presence scaling, websocket subprotocol auth + search limiter, and hygiene closeout (#7/#9/#10/#13/#14/#18/#19/#20/#21/#27/#28/#41). **2026-04-21 (remaining tranche):** closed the rest of the audit (#16/#17/#23/#24/#25/#26/#29/#30/#31/#32/#33/#34/#35/#36/#37/#39/#40/#42/#43/#44/#45), including shell lifecycle hardening, retrieval tuning, CI verification wiring, and full documentation closeout.

### Near-term — hardening & parity

1. **`POST /api/lore/query` hardening** — Baseline in-memory rate limit is shipped; before a public URL add auth, edge firewall, or Redis / Vercel KV for global limits.
2. **Index + embedding ops** — Tune HNSW / IVFFLAT on Neon. Server **`after()`** vault reindex on item PATCH/create (`schedule-vault-index-after.ts`) is **default on**; set **`HEARTGARDEN_INDEX_AFTER_PATCH=0`** to disable. Add a global queue if volume still exceeds debounced client + reindex.
3. **Retrieval observability** — `HEARTGARDEN_VAULT_DEBUG=1` enables `console.debug` RRF diagnostics in `vault-retrieval.ts` (shipped).
4. **E2E** — Optional: palette → lore panel smoke (skip or mock LLM in CI).
5. **Canvas version history (UX2 — decision for v1)** — **Export-first:** the canvas already supports **Export graph JSON** (Cmd+K). Treat that as the supported “checkpoint” workflow until a DB snapshot or `item_revisions` table is justified. **Space / graph snapshots** and **per-item revision logs** remain future options; any in-app restore must not silently fight the local undo stack (explicit “restore from server snapshot” only).
6. **Space nav hardening (residual)** — **`enterSpace`** already uses a **generation guard** so stale fetches do not apply. Optional: **abort** in-flight bootstrap fetch on newer navigation, or a **short CSS-only** nav cue when canvas effects are **off** for parity with the WebGL transition.
7. **Collab delta API (beyond full `itemIds` every poll)** — Optional next tracks: **E2** tombstones / `deleted_item_ids` since cursor; **E3** monotonic subtree revision so thin clients never re-enumerate full id sets on recovery. The **official shell** already sends **`includeItemIds=1`** every poll (`docs/API.md`); lighter integrations may omit it.

**Lore import + data pipeline (audit tranche):** [`DATA_PIPELINE_AUDIT_2026-04-11.md`](./DATA_PIPELINE_AUDIT_2026-04-11.md) §10–§12 (registry, conformance tests, smoke gate, multiplayer expectations). Execution tracks and YAML todos: [`.cursor/plans/data_pipeline_import_hardening.plan.md`](../../.cursor/plans/data_pipeline_import_hardening.plan.md).

**Canonical kind → DB / canvas mapping (import):** [`LORE_IMPORT_KIND_MAPPING.md`](./LORE_IMPORT_KIND_MAPPING.md) — code: `src/lib/lore-object-registry.ts` (land with Agent mode if not present).

### Mid-term — master plan Phase 5 (TTRPG + intelligence)

Matches **legacy** Phase 5 themes and **`FOLLOW_UP.md`** LLM items (see archive master plan for original wording):

- Markdown bulk import + entity extraction pipeline.
- Auto-linking beyond in-note **`[[` assist** (popover in `BufferedContentEditable`) — e.g. batch suggest + review UX for imports.
- Deeper graph/timeline integration with persisted `item_links` and UUID stability everywhere.
- Lore consistency checker (LLM).

### Later — Phases 6–8 + `VISUAL_REVAMP_PLAN`

- Visual/typography polish, performance (culling, bundle), PWA/offline strategy, prefs — per legacy master plan + **`FOLLOW_UP.md`**.

---

## Legacy session list (`docs/archive/vigil-master-plan-legacy.md`)

The numbered **Sessions 1–38** there are **historical ordering guidance** only. Execution status is tracked **here**, in the **Cursor lore plan** (Phases B–D), and in **`STRATEGY.md`**.

### Stub at `VIGIL_MASTER_PLAN.md`

The path is kept so old links work; it redirects to **`docs/archive/vigil-master-plan-legacy.md`** for the full text. For *what to build next*, prefer the **Cursor plan** + this file.

---

*Living document — edit when shipping or reprioritizing.*
