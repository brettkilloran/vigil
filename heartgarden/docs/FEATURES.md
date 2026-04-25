---
title: heartgarden — shipped features
status: canonical
audience: [agent, human]
last_reviewed: 2026-04-21
canonical: true
related:
  - heartgarden/docs/API.md
  - heartgarden/docs/CODEMAP.md
  - heartgarden/docs/BUILD_PLAN.md
  - heartgarden/docs/EDITOR_HG_DOC.md
  - heartgarden/docs/DATA_PIPELINE_AUDIT_2026-04-11.md
---

# heartgarden — shipped features (reference)

Single place to **look up what exists** and where it lives. For **HTTP contracts**, see **`docs/API.md`**. For **subsystem file maps**, see **`docs/CODEMAP.md`**. For **player / GM boot rules**, see **`docs/PLAYER_LAYER.md`**. For **open engineering backlog (SOT)**, see **`docs/BACKLOG.md`**. For **architecture + shipped tranches**, see **`docs/BUILD_PLAN.md`**.

---

## Collaboration & sync

| Feature | What users see / behavior | Docs | Primary code |
|--------|----------------------------|------|----------------|
| **Delta sync** | Polling as above; **`itemLinksRevision`** on `GET …/changes` (cheap aggregate) gates **`GET …/graph`** so massive spaces do not re-download all edges every poll. Realtime **`item-links.changed`** and `GET …/link-revision` (when WebSocket down) still catch pure link writes. | [`API.md`](./API.md) (`GET …/changes`, `GET …/link-revision`), [`PLAYER_LAYER.md`](./PLAYER_LAYER.md) | `item-links-space-revision.ts`, `use-heartgarden-space-change-sync.ts`, `ArchitecturalCanvasApp.tsx` |
| **Soft presence** | Emoji chips in status bar (subtree peers), remote cursors, **follow** another tab’s view (confirm if focus/stack open) | [`PLAYER_LAYER.md`](./PLAYER_LAYER.md), [`API.md`](./API.md) (`…/presence`) | `canvas_presence` in `schema.ts`, `presence/route.ts`, `use-heartgarden-presence-heartbeat.ts`, `ArchitecturalRemotePresenceLayer.tsx`, `collab-presence-identity.ts` |
| **PATCH conflict (409)** | Server version wins; shell surfaces a **conflict banner** with server copy vs dismiss (keep local draft); dev-only `NEXT_PUBLIC_HEARTGARDEN_SYNC_DEBUG=1` logs PATCH timing | [`API.md`](./API.md) (Items PATCH) | `app/api/items/[itemId]/route.ts`, item patch flow in `ArchitecturalCanvasApp.tsx` / `architectural-neon-api.ts`, `heartgarden-sync-debug.ts` |
| **Remote merge / protected ids** | Graph merge preserves local title/body for focus overlay, **inline** drafts, and **in-flight PATCH** ids; poll `updatedAt` map only advances when newer (no regress) | [`API.md`](./API.md) (browser shell — delta sync) | `architectural-db-bridge.ts`, `architectural-db-bridge.merge-remote.test.ts`, `heartgarden-space-change-sync-utils.ts` |
| **Realtime invalidation (optional)** | When **`HEARTGARDEN_REALTIME_*`** is set + **`pnpm run realtime`**, WebSocket events wake peers; Neon + **`GET …/changes`** remain source of truth | [`API.md`](./API.md) (Realtime), [`DEPLOY_VERCEL.md`](./DEPLOY_VERCEL.md) §5.5 | `use-heartgarden-realtime-space-sync.ts`, `heartgarden-realtime-*.ts`, `scripts/realtime-server.ts` |

---

## Canvas navigation & chrome

| Feature | What users see / behavior | Docs | Primary code |
|--------|----------------------------|------|----------------|
| **Minimap** | Bottom-left map toggle in viewport metrics strip; world overview, pan/fit | [`CODEMAP.md`](./CODEMAP.md) (Canvas chrome) | `CanvasMinimap.tsx`, `ArchitecturalViewportMetricsStrip` / status metrics in `ArchitecturalStatusBar.tsx`, prefs `VIGIL_MINIMAP_VISIBLE_STORAGE_KEY` in `vigil-canvas-prefs.ts` |
| **Fit / frame camera** | Zoom-to-fit content, fit selection, world rect helpers for minimap & UI | [`CODEMAP.md`](./CODEMAP.md) (Canvas chrome) | `canvas-view-bounds.ts`, `canvas-view-bounds.test.ts` |
| **Viewport arrival (origin)** | Bootstrap, opening a folder, and related transitions land with **world (0,0) at viewport center**, zoom 1 — no restoring stale localStorage pan on load; pan/zoom still persist while you work | [`AGENTS.md`](../AGENTS.md) (Canvas camera) | `defaultCamera(w,h)` in `canvas-types.ts`, `heartgarden-space-camera.ts`, `applyBootstrapData` / `enterSpace` / `recenterToOrigin` in `ArchitecturalCanvasApp.tsx` |
| **Viewport toast** | Short-lived bottom message (e.g. nav hints) with cooldown | [`CODEMAP.md`](./CODEMAP.md) (Canvas chrome) | `CanvasViewportToast.tsx` |
| **Space transitions** | Optional WebGL flow overlay when **canvas effects** on; dimmed scene during `enterSpace` fetch; **generation guard** drops stale async completions if user navigates again | [`BUILD_PLAN.md`](./BUILD_PLAN.md) | `VigilFlowRevealOverlay.tsx` (dynamic `next/dynamic`), `enterSpace` + `spaceNavGenerationRef` in `ArchitecturalCanvasApp.tsx` |
| **Folder delete pop-out** | Deleting a folder removes the folder shell but moves its immediate children (items and sub-folders) into the parent space using preserved relative offsets; nested folder internals remain intact | [`AGENTS.md`](../AGENTS.md) (Current code reality) | `deleteEntitySelection` in `ArchitecturalCanvasApp.tsx`, `architectural-folder-popout.ts`, `app/api/items/[itemId]/route.ts`, `app/api/spaces/[spaceId]/route.ts` |
| **Dock + stack modal** | Chrome layout safe when stack modal open (no clipped controls) | [`BUILD_PLAN.md`](./BUILD_PLAN.md) (architecture snapshot), [`CODEMAP.md`](./CODEMAP.md) | `ArchitecturalCanvasApp.tsx` + related CSS modules |
| **Lore create (bottom dock)** | One-click create for **Character**, **Organization**, and **Location**; server/client normalize to canonical shells (character `v11`, faction `v4`, location `v7`) | [`CODEMAP.md`](./CODEMAP.md) | `ArchitecturalBottomDock.tsx` (`DEFAULT_CREATE_ACTIONS`), `createNewNode` in `ArchitecturalCanvasApp.tsx`, `resolveLoreCardForCreate` |
| **Empty-canvas context menu** | Right-click **empty viewport** (not on a card) → one-click create **character**, **organization**, or **location** (same canonical variants as dock) | [`CODEMAP.md`](./CODEMAP.md) (Canvas chrome) | `canvasEmptyContextMenu` + `handleViewportContextMenuCapture` in `ArchitecturalCanvasApp.tsx` |

---

## Search, vault index, lore

| Feature | What users see / behavior | Docs | Primary code |
|--------|----------------------------|------|----------------|
| **Cmd+K palette** | Search suggest, spaces, actions, **lore create shortcuts** (character, organization, location), export, recents (caps expanded over time) | [`API.md`](./API.md) (`/api/search/suggest`) | `paletteActions` / `runPaletteAction` in `ArchitecturalCanvasApp.tsx`, `app/api/search/suggest/route.ts` |
| **Vault index status** | Status bar line for “indexing notes…” / errors (pending + in-flight) | [`CODEMAP.md`](./CODEMAP.md) (Search & vault index), [`API.md`](./API.md) (`POST …/index`) | `vault-index-status-bus.ts`, `VaultIndexStatusInline` in `ArchitecturalStatusBar.tsx`, debounced index in `architectural-neon-api.ts` |
| **Hybrid / semantic search** | Palette + `/api/search` RRF when embeddings exist; lexical-only fallback when OpenAI embeddings are not configured. Vector chunks carry heading breadcrumbs so retrieval can dedupe by section and boost heading-leaf exact matches on short queries. | [`API.md`](./API.md), [`BUILD_PLAN.md`](./BUILD_PLAN.md), [`VERCEL_ENV_VARS.md`](./VERCEL_ENV_VARS.md) | `app/api/search/route.ts`, `vault-retrieval.ts`, `vault-retrieval-rrf.ts`, `embedding-provider.ts` |
| **Ask lore** | Lore Q&A panel with source snippets; when chunk metadata is available, sources include section breadcrumbs (`H1 > H2 > H3`) for tighter grounding and citation context. | [`API.md`](./API.md) (`/api/lore/query`) | `LoreAskPanel.tsx`, `lore-engine.ts` |

---

## Editing & content

| Feature | What users see / behavior | Docs | Primary code |
|--------|----------------------------|------|----------------|
| **Modular note editor (hgDoc)** | Default/task cards + focus mode use TipTap blocks; body persists as `content_json.format: "hgDoc"` with derived HTML for links. MCP/import structured-body writes enforce heading quality (H1 required for generic docs, H2/H3 heuristics, no level skipping). | [`EDITOR_HG_DOC.md`](./EDITOR_HG_DOC.md) | `HeartgardenDocEditor.tsx`, `src/lib/hg-doc/*`, `architectural-db-bridge.ts` |
| **AI / import pending text (`hgAiPending`)** | Inline **pending** styling for AI or imported prose; per-span **Bind** in the editor margin (hgDoc); editing inside a span participates in undo/redo | [`EDITOR_HG_DOC.md`](./EDITOR_HG_DOC.md) | `hg-doc/hg-ai-pending-mark.ts`, `HgAiPendingEditorGutter.tsx`, `collect-hg-ai-pending-ranges.ts`, `remove-hg-ai-pending-range.ts`, `strip-hg-ai-pending.ts`, `app/globals.css` (`--sem-text-ai-pending`) |
| **Unreviewed / Accept (focus bar)** | `items.entity_meta.aiReview === "pending"` shows **Unreviewed** + **Accept** in the focus-mode review bar when body markup is still pending (hgDoc JSON or `data-hg-ai-pending` HTML); Accept strips marks and clears `aiReview` | [`DATA_PIPELINE_AUDIT_2026-04-11.md`](./DATA_PIPELINE_AUDIT_2026-04-11.md), [`EDITOR_HG_DOC.md`](./EDITOR_HG_DOC.md) | `acceptAiReviewForEntity` + pending detection / review bar rendering in `ArchitecturalCanvasApp.tsx` |
| **Lore import + review flags** | Import opens an upfront mode popover: **One note** (skip planner, create one card), **Many loose** (default; entity extraction on current canvas without folders), **Many in folders** (existing structured mode), and scope choice (**This space & its folders** vs **Entire GM workspace**). Review adds recovery actions (**Collapse to one note**, **Flatten to Nearby**), per-merge accept/reject controls, and per-note target-space overrides before apply. Smart `/jobs` → `/apply` wraps imported bodies with pending spans and sets **`aiReview: pending`**; accepted merge flows extend structured HTML without flattening prior body. Legacy `/extract` + `/commit` routes are deprecated and return HTTP 410 unless **`HEARTGARDEN_IMPORT_LEGACY_ENABLED=1`**. | [`API.md`](./API.md) (lore import) | `ArchitecturalCanvasApp.tsx`, `ArchitecturalLoreImportUploadPopover.tsx`, `lore-import-plan-reshuffle.ts`, `lore-import-apply.ts`, `app/api/lore/import/*` |
| **Dev: AI pending style** | `/dev/ai-pending-style` — static + live hgDoc samples for pending styling | [`CODEMAP.md`](./CODEMAP.md) (App shell — dev pages) | `app/dev/ai-pending-style/*` |
| **Dev: lore entity lab** | `/dev/lore-entity-nodes` — design previews for character / org / location canvas shells | [`CODEMAP.md`](./CODEMAP.md) (App shell — dev pages), [`CANVAS_LORE_NODE_PATTERNS.md`](./CANVAS_LORE_NODE_PATTERNS.md) | `app/dev/lore-entity-nodes/page.tsx`, `src/components/dev/LoreEntityNodeLab.tsx` |
| **Alt-hover discovery (term graph)** | Holding **Alt** and hovering body text highlights the word under the cursor and opens a small popover (**Alt graph card**) showing items that mention that term and search hits across the workspace. Works across folders inside a brane (cross-space mention edges). Click while Alt-held to open the full **Graph panel**. | [`API.md`](./API.md) (graph + mentions routes), [`PLAYER_LAYER.md`](./PLAYER_LAYER.md) | `ArchitecturalCanvasApp.tsx` (Alt-hover effect), `AltGraphCard.tsx`, `GraphPanel.tsx`, `entity-mentions.ts`, `entity-vocabulary.ts`, `word-under-pointer.ts`, `entity_mentions` / `branes` tables |
| **Internal links** | `vigil:item:` resolution in shell | [`AGENTS.md`](../AGENTS.md) | `ArchitecturalLinksPanel` / link resolution paths in foundation |
| **Connections (three surfaces)** | **Canvas threads** (associations: drawn ropes, `item_links` + pins); **structured bindings** on lore cards (`content_json.hgArch` — roster, thread anchors); **wiki mentions** (`vigil:item` / `[[`, soft recall neighbors); **FTS related**. See [`BINDINGS_CATALOG.md`](./BINDINGS_CATALOG.md). Thread tags include **Other** for custom labels. | [`CODEMAP.md`](./CODEMAP.md), [`BINDINGS_CATALOG.md`](./BINDINGS_CATALOG.md) | `ArchitecturalCanvasApp.tsx`, `ArchitecturalLinksPanel.tsx`, `lore-link-types.ts`, `bindings-catalog.ts`, `canvas-thread-link-eval.ts` |

---

## Media & performance

| Feature | What users see / behavior | Docs | Primary code |
|--------|----------------------------|------|----------------|
| **Zoom-aware image URLs** | Optional CDN resize template for card images by zoom | [`FOLLOW_UP.md`](./FOLLOW_UP.md) | `heartgarden-image-display-url.ts`, **`NEXT_PUBLIC_HEARTGARDEN_IMAGE_URL_TEMPLATE`** (see `.env.local.example`) |
| **Viewport culling** | Off-screen entities / stacks / connections skip heavy work | [`BUILD_PLAN.md`](./BUILD_PLAN.md) | `canvas-viewport-cull.ts`, wired in `ArchitecturalCanvasApp.tsx` |
| **Bundle analyze** | Webpack bundle analyzer opt-in | [`README.md`](../README.md) (Scripts — more pnpm tasks), [`BUILD_PLAN.md`](./BUILD_PLAN.md) | `pnpm run analyze` in `package.json` |

---

## Boot, access, ops

| Feature | What users see / behavior | Docs | Primary code |
|--------|----------------------------|------|----------------|
| **PIN boot gate** | Splash PINs, signed `hg_boot`, rate limit, log out | [`API.md`](./API.md), [`PLAYER_LAYER.md`](./PLAYER_LAYER.md), [`VERCEL_ENV_VARS.md`](./VERCEL_ENV_VARS.md) | `VigilAppBootScreen`, `proxy.ts`, `heartgarden-boot-*.ts` |
| **Players tier** | Single scoped space, API enforcement | [`PLAYER_LAYER.md`](./PLAYER_LAYER.md) | `heartgarden-api-boot-context.ts`, `heartgarden-space-route-access.ts` |
| **Presence POST rate limit** | Per public IP budget (NAT-friendly defaults) | [`API.md`](./API.md), [`PLAYER_LAYER.md`](./PLAYER_LAYER.md) | `heartgarden-presence-rate-limit.ts` |
| **Search rate limit** | Per public IP budget on `GET /api/search`; returns `429` + `Retry-After: 60` on bursts | [`API.md`](./API.md) | `search-rate-limit.ts`, `app/api/search/route.ts` |

---

## Tests & quality gates

| Feature | Docs | Primary code |
|--------|------|----------------|
| Unit tests | [`AGENTS.md`](../AGENTS.md) | `src/**/*.test.ts`, `vitest.config.ts` |
| E2E (incl. collab API stubs) | [`AGENTS.md`](../AGENTS.md) | `e2e/collab-api.spec.ts`, `playwright.config.ts` |
| Storybook | [`AGENTS.md`](../AGENTS.md) | `.storybook/`, `*.stories.tsx` |

---

*Update this file when a user-visible or maintainer-facing capability ships in production. Prefer linking out to `API.md` / `PLAYER_LAYER.md` instead of duplicating env lists.*
