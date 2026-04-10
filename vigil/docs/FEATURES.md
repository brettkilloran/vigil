---
title: heartgarden — shipped features
status: canonical
audience: [agent, human]
last_reviewed: 2026-04-10
canonical: true
related:
  - vigil/docs/API.md
  - vigil/docs/CODEMAP.md
  - vigil/docs/BUILD_PLAN.md
---

# heartgarden — shipped features (reference)

Single place to **look up what exists** and where it lives. For **HTTP contracts**, see **`docs/API.md`**. For **subsystem file maps**, see **`docs/CODEMAP.md`**. For **player / GM boot rules**, see **`docs/PLAYER_LAYER.md`**. For **backlog**, see **`docs/BUILD_PLAN.md`**.

---

## Collaboration & sync

| Feature | What users see / behavior | Docs | Primary code |
|--------|----------------------------|------|----------------|
| **Delta sync** | Other tabs’ edits merge via polling; optional full **item id** list after nav or tab focus for delete tombstones; **spaces** rows when folders reparent/rename | [`API.md`](./API.md) (`GET …/changes`), [`PLAYER_LAYER.md`](./PLAYER_LAYER.md) | `use-heartgarden-space-change-sync.ts`, `architectural-neon-api.ts` `fetchSpaceChanges`, `app/api/spaces/[spaceId]/changes/route.ts`, `heartgarden-space-change-sync-utils.ts` |
| **Soft presence** | Emoji chips in status bar (subtree peers), remote cursors, **follow** another tab’s view (confirm if focus/stack open) | [`PLAYER_LAYER.md`](./PLAYER_LAYER.md), [`API.md`](./API.md) (`…/presence`) | `canvas_presence` in `schema.ts`, `presence/route.ts`, `use-heartgarden-presence-heartbeat.ts`, `ArchitecturalRemotePresenceLayer.tsx`, `collab-presence-identity.ts` |
| **PATCH conflict (409)** | Server version wins; shell can surface conflict UX; rapid solo edits avoid spurious toasts where fixed | [`API.md`](./API.md) (Items PATCH) | `app/api/items/[itemId]/route.ts`, item patch flow in `ArchitecturalCanvasApp.tsx` / `architectural-neon-api.ts` |
| **Remote merge / protected ids** | Graph merge skips protected server rows when applying remote patches | — | `architectural-db-bridge.ts`, `architectural-db-bridge.merge-remote.test.ts` |

---

## Canvas navigation & chrome

| Feature | What users see / behavior | Docs | Primary code |
|--------|----------------------------|------|----------------|
| **Minimap** | Bottom-left map toggle in viewport metrics strip; world overview, pan/fit | — | `CanvasMinimap.tsx`, `ArchitecturalViewportMetricsStrip` / status metrics in `ArchitecturalStatusBar.tsx`, prefs `VIGIL_MINIMAP_VISIBLE_STORAGE_KEY` in `vigil-canvas-prefs.ts` |
| **Fit / frame camera** | Zoom-to-fit content, fit selection, world rect helpers for minimap & UI | — | `canvas-view-bounds.ts`, `canvas-view-bounds.test.ts` |
| **Viewport arrival (origin)** | Bootstrap, opening a folder, and related transitions land with **world (0,0) at viewport center**, zoom 1 — no restoring stale localStorage pan on load; pan/zoom still persist while you work | [`AGENTS.md`](../AGENTS.md) (Canvas camera) | `defaultCamera(w,h)` in `canvas-types.ts`, `heartgarden-space-camera.ts`, `applyBootstrapData` / `enterSpace` / `recenterToOrigin` in `ArchitecturalCanvasApp.tsx` |
| **Viewport toast** | Short-lived bottom message (e.g. nav hints) with cooldown | — | `CanvasViewportToast.tsx` |
| **Space transitions** | Optional WebGL flow overlay when **canvas effects** on; dimmed scene during `enterSpace` fetch; **generation guard** drops stale async completions if user navigates again | [`BUILD_PLAN.md`](./BUILD_PLAN.md) | `VigilFlowRevealOverlay.tsx` (dynamic `next/dynamic`), `enterSpace` + `spaceNavGenerationRef` in `ArchitecturalCanvasApp.tsx` |
| **Dock + stack modal** | Chrome layout safe when stack modal open (no clipped controls) | — | `ArchitecturalCanvasApp.tsx` + related CSS modules |

---

## Search, vault index, lore

| Feature | What users see / behavior | Docs | Primary code |
|--------|----------------------------|------|----------------|
| **Cmd+K palette** | Search suggest, spaces, actions, export, recents (caps expanded over time) | [`API.md`](./API.md) (`/api/search/suggest`) | Command palette wiring in `ArchitecturalCanvasApp.tsx`, `app/api/search/suggest/route.ts` |
| **Vault index status** | Status bar line for “indexing notes…” / errors (pending + in-flight) | — | `vault-index-status-bus.ts`, `VaultIndexStatusInline` in `ArchitecturalStatusBar.tsx`, debounced index in `architectural-neon-api.ts` |
| **Hybrid / semantic search** | Palette + `/api/search` RRF when embeddings exist | [`API.md`](./API.md), [`BUILD_PLAN.md`](./BUILD_PLAN.md) | `app/api/search/route.ts`, `vault-retrieval-rrf.ts` |
| **Ask lore** | Lore Q&A panel | [`API.md`](./API.md) (`/api/lore/query`) | `LoreAskPanel.tsx`, `lore-engine.ts` |

---

## Editing & content

| Feature | What users see / behavior | Docs | Primary code |
|--------|----------------------------|------|----------------|
| **Wiki link `[[` assist** | Typing `[[` in rich text opens popover to pick / create wiki targets | — | `BufferedContentEditable.tsx`, `WikiLinkAssistPopover.tsx`, `wiki-link-caret.ts`, `wiki-link-caret.test.ts` |
| **Internal links** | `vigil:item:` resolution in shell | [`AGENTS.md`](../AGENTS.md) | `ArchitecturalLinksPanel` / link resolution paths in foundation |

---

## Media & performance

| Feature | What users see / behavior | Docs | Primary code |
|--------|----------------------------|------|----------------|
| **Zoom-aware image URLs** | Optional CDN resize template for card images by zoom | [`FOLLOW_UP.md`](./FOLLOW_UP.md) | `heartgarden-image-display-url.ts`, **`NEXT_PUBLIC_HEARTGARDEN_IMAGE_URL_TEMPLATE`** (see `.env.local.example`) |
| **Viewport culling** | Off-screen entities / stacks / connections skip heavy work | [`BUILD_PLAN.md`](./BUILD_PLAN.md) | `canvas-viewport-cull.ts`, wired in `ArchitecturalCanvasApp.tsx` |
| **Bundle analyze** | Webpack bundle analyzer opt-in | — | `npm run analyze` in `package.json` |

---

## Boot, access, ops

| Feature | What users see / behavior | Docs | Primary code |
|--------|----------------------------|------|----------------|
| **PIN boot gate** | Splash PINs, signed `hg_boot`, rate limit, log out | [`API.md`](./API.md), [`PLAYER_LAYER.md`](./PLAYER_LAYER.md), [`VERCEL_ENV_VARS.md`](./VERCEL_ENV_VARS.md) | `VigilAppBootScreen`, `middleware.ts`, `heartgarden-boot-*.ts` |
| **Players tier** | Single scoped space, API enforcement | [`PLAYER_LAYER.md`](./PLAYER_LAYER.md) | `heartgarden-api-boot-context.ts`, `heartgarden-space-route-access.ts` |
| **Presence POST rate limit** | Per public IP budget (NAT-friendly defaults) | [`API.md`](./API.md), [`PLAYER_LAYER.md`](./PLAYER_LAYER.md) | `heartgarden-presence-rate-limit.ts` |

---

## Tests & quality gates

| Feature | Docs | Primary code |
|--------|------|----------------|
| Unit tests | [`AGENTS.md`](../AGENTS.md) | `src/**/*.test.ts`, `vitest.config.ts` |
| E2E (incl. collab API stubs) | [`AGENTS.md`](../AGENTS.md) | `e2e/collab-api.spec.ts`, `playwright.config.ts` |
| Storybook | [`AGENTS.md`](../AGENTS.md) | `.storybook/`, `*.stories.tsx` |

---

*Update this file when a user-visible or maintainer-facing capability ships in production. Prefer linking out to `API.md` / `PLAYER_LAYER.md` instead of duplicating env lists.*
