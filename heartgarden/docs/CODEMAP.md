---
title: heartgarden — code map
status: canonical
audience: [agent, human]
last_reviewed: 2026-04-21
canonical: true
related:
  - heartgarden/docs/FEATURES.md
  - heartgarden/docs/API.md
---

# heartgarden — code map

High-level map from **feature / subsystem** to **primary files**. This does not list every symbol; use `docs/API.md` for HTTP routes and jump-to-definition for details. **Keep this file updated** when you add a new vertical (major API family, new sync path, or new shell concern).

## App shell & routing


| Concern                                       | Location                                                                    |
| --------------------------------------------- | --------------------------------------------------------------------------- |
| Next app root, global CSS                     | `app/layout.tsx`, `app/page.tsx`, `app/globals.css`                         |
| Edge boot gate (**`/api/*`** when PIN on)     | `proxy.ts` (matcher **`/api/:path*`**), `src/lib/heartgarden-boot-edge.ts`, `src/lib/heartgarden-boot-gate-bypass.ts` |
| Client mount, boot gate                       | `app/_components/VigilApp.tsx`                                              |
| Dev-only pages (**`/dev/*`**, unindexed)      | `app/dev/ai-pending-style/page.tsx`, `app/dev/lore-entity-nodes/page.tsx` → `src/components/dev/*` |
| Production canvas UI (graph state lives here) | `src/components/foundation/ArchitecturalCanvasApp.tsx`                      |
| Browser-local camera storage + arrival policy | `src/lib/heartgarden-space-camera.ts` (see `**AGENTS.md`** → Canvas camera) |
| Foundation types / pieces                     | `src/components/foundation/*`                                               |
| Flow / WebGL overlay (optional)               | `src/components/transition-experiment/VigilFlowRevealOverlay.tsx`           |
| Panel / prefs state (not canvas graph SoT)   | Local React state + `src/lib/vigil-canvas-prefs.ts` (minimap, etc.); graph lives only in `ArchitecturalCanvasApp` |


## Canvas chrome, navigation & note editing


| Concern                                                                                                     | Location                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Minimap + viewport metrics strip                                                                            | `src/components/foundation/CanvasMinimap.tsx`, `src/components/foundation/ArchitecturalStatusBar.tsx` (`ArchitecturalViewportMetrics`), `src/lib/vigil-canvas-prefs.ts`                                                            |
| Fit camera / world bounds for UI                                                                            | `src/lib/canvas-view-bounds.ts`                                                                                                                                                                                                   |
| Default camera / `CameraState`                                                                              | `src/model/canvas-types.ts` (`defaultCamera`)                                                                                                                                                                                     |
| Transient viewport toasts                                                                                   | `src/components/foundation/CanvasViewportToast.tsx`                                                                                                                                                                               |
| Default/task note bodies (TipTap hgDoc)                                                                     | `src/components/editing/HeartgardenDocEditor.tsx`, `src/lib/hg-doc/*`, `docs/EDITOR_HG_DOC.md`                                                                                                                                    |
| **hgDoc `hgAiPending` mark, margin Bind, strip pending**                                                    | `src/lib/hg-doc/hg-ai-pending-mark.ts`, `collect-hg-ai-pending-ranges.ts`, `remove-hg-ai-pending-range.ts`, `strip-hg-ai-pending.ts`, `src/components/editing/HgAiPendingEditorGutter.tsx`, tests in `hg-ai-pending-mark.test.ts` |
| **Unreviewed / Accept** (`entity_meta.aiReview`, pending body detection)                                    | `src/components/foundation/ArchitecturalNodeCard.tsx`, `ArchitecturalCanvasApp.tsx` (`acceptAiReviewForEntity`, `contentEntityHasHgAiPending`)                                                                                    |
| **Cmd+K palette** (search, actions, **lore create shortcuts**, export, …)                                   | `src/components/foundation/ArchitecturalCanvasApp.tsx` (`paletteActions`, `runPaletteAction`), `src/components/ui/CommandPalette.tsx`                                                                                             |
| **Bottom dock** (create strip, one-click lore creates for character/faction/location)                       | `src/components/foundation/ArchitecturalBottomDock.tsx` (`DEFAULT_CREATE_ACTIONS`, `ArchitecturalCreateMenu`)                                                                                                                     |
| **Empty-canvas context menu** (lore creates on right-click empty viewport)                                  | `src/components/foundation/ArchitecturalCanvasApp.tsx` (`canvasEmptyContextMenu`, `canvasEmptyContextMenuItems`, `handleViewportContextMenuCapture`)                                                                              |
| Buffered rich text (lore, code, media captions)                                                             | `src/components/design-system/primitives/BufferedContentEditable.tsx`                                                                                                                                                             |
| **Alt-hover discovery (term graph card + brane graph)**                                                     | `ArchitecturalCanvasApp.tsx` (Alt-hover effect), `src/components/product-ui/canvas/AltGraphCard.tsx`, `src/components/product-ui/canvas/GraphPanel.tsx`, `src/lib/entity-mentions.ts`, `src/lib/entity-vocabulary.ts`, `src/lib/word-under-pointer.ts`, `branes` / `entity_mentions` tables (drizzle migrations 0015–0017) |
| Resolved image URLs (zoom / CDN template)                                                                   | `src/lib/heartgarden-image-display-url.ts`                                                                                                                                                                                        |
| Viewport culling (entities, stacks, connections)                                                            | `src/lib/canvas-viewport-cull.ts`                                                                                                                                                                                                 |
| **Canvas threads + link-type taxonomy** (grouped relationship vs legacy role tags, endpoint-aware ordering) | `src/lib/lore-link-types.ts`, `mergeHydratedDbConnections` in `src/lib/architectural-item-link-graph.ts`, `ArchitecturalCanvasApp.tsx` (draw/cut, thread context menu)                                                            |
| **Connections inspector** (threads vs wiki vs Neon vs FTS — summary + lists)                                | `src/components/ui/ArchitecturalLinksPanel.tsx`                                                                                                                                                                                   |


## Lore canvas node variants (custom bodies, ID cards)


| Concern                                                                                                   | Location                                                             |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Patterns & checklist for new node types**                                                               | `**docs/CANVAS_LORE_NODE_PATTERNS.md`**                              |
| **Character focus + persistence / migration plan**                                                        | `**docs/CHARACTER_FOCUS_AND_DATA_MODEL_PLAN.md`**                    |
| Lore seed HTML, `loreCard`, body detection                                                                | `src/lib/lore-node-seed-html.ts`                                     |
| Shared card markup CSS (portable `bodyHtml`)                                                              | `src/components/foundation/lore-entity-card.module.css`              |
| Example: character v11 canvas shell                                                                       | `src/components/foundation/ArchitecturalLoreCharacterCanvasNode.tsx` |
| Example: character/location/faction focus uses hybrid focus shell + notes editor                           | `src/components/editing/LoreHybridFocusEditor.tsx`, `ArchitecturalCanvasApp.tsx`, `src/lib/lore-*-focus-document-html.ts` |


## Persistence (Neon) & canvas sync


| Concern                                 | Location                                                                                                                                            |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hydrate / active space + items          | `app/api/bootstrap/route.ts` → `src/lib/spaces.ts`                                                                                                  |
| Client ↔ API bridge                     | `src/components/foundation/architectural-neon-api.ts`, `architectural-db-bridge.ts`                                                                 |
| Delta poll + merge (space changes hook) | `src/hooks/use-heartgarden-space-change-sync.ts`, `src/lib/heartgarden-space-change-sync-utils.ts`, opt-in PATCH debug `src/lib/heartgarden-sync-debug.ts` |
| Collab metrics (poll / PATCH counters)  | `src/lib/heartgarden-collab-metrics.ts` (`installHeartgardenCollabMetricsGlobal` → `window.__heartgardenCollabMetrics`)                               |
| Sync status bus                         | `src/lib/neon-sync-bus.ts`                                                                                                                          |
| Undo / redo (in-memory)                 | `src/components/foundation/architectural-undo.ts`                                                                                                   |
| Item row ↔ canvas shape                 | `src/lib/item-mapper.ts`, `src/model/canvas-types.ts`                                                                                               |
| Space subtree / camera                  | `src/lib/spaces.ts`                                                                                                                                 |
| Subtree helper (presence GET)           | `src/lib/heartgarden-space-subtree.ts`                                                                                                              |
| Presence POST body validation           | `src/lib/heartgarden-presence-body.ts`                                                                                                              |
| Presence client + poll/heartbeat        | `src/hooks/use-heartgarden-presence-heartbeat.ts`, `src/components/foundation/architectural-neon-api.ts`, `src/lib/heartgarden-collab-constants.ts` |
| Remote cursors + emoji identity         | `src/components/foundation/ArchitecturalRemotePresenceLayer.tsx`, `src/lib/collab-presence-identity.ts`                                             |
| **Link fingerprint** (`itemLinksRevision`, `GET …/link-revision`) | `src/lib/item-links-space-revision.ts`, `app/api/spaces/[spaceId]/link-revision/route.ts` |


## Optional realtime (WebSocket invalidation)


| Concern | Location |
| ------- | -------- |
| Client subscription + reconnect | `src/hooks/use-heartgarden-realtime-space-sync.ts` |
| Config + channel naming | `src/lib/heartgarden-realtime-config.ts` |
| Room JWT issue (**`POST /api/realtime/room-token`**) | `app/api/realtime/room-token/route.ts`, `src/lib/heartgarden-realtime-token.ts` |
| Redis publish after writes | `src/lib/heartgarden-realtime-publisher.ts`, `src/lib/heartgarden-realtime-invalidation.ts` |
| Publish timings (**`GET /api/realtime/metrics`**) | `src/lib/heartgarden-realtime-publish-metrics.ts`, `app/api/realtime/metrics/route.ts` |
| Long-lived WebSocket server | `scripts/realtime-server.ts` (**`npm run realtime`**), optional `Dockerfile.realtime` |
| Redis smoke | `scripts/realtime-redis-smoke.ts` (**`npm run realtime:redis-smoke`**) |


## Search & vault index


| Concern                                  | Location                                                                                      |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| FTS + fuzzy + hybrid RRF                 | `app/api/search/route.ts`, `src/lib/spaces.ts` (search helpers)                               |
| Search rate limit                        | `src/lib/search-rate-limit.ts`                                                                |
| Suggest (palette)                        | `app/api/search/suggest/route.ts`                                                             |
| Raw chunk hits                           | `app/api/search/chunks/route.ts`                                                              |
| Hybrid retrieval (FTS + vector + fusion) | `src/lib/vault-retrieval.ts`, `vault-retrieval-rrf.ts`                                        |
| Chunk + embed + lore meta on item        | `app/api/items/[itemId]/index/route.ts`, `src/lib/item-vault-index.ts`, `lore-item-meta.ts`   |
| Vault index UI status (status bar)       | `src/lib/vault-index-status-bus.ts` → `ArchitecturalStatusBar.tsx` (`VaultIndexStatusInline`) |
| Debounced / `after()` reindex            | `src/lib/schedule-vault-index-after.ts`                                                       |
| Embeddings provider                      | `src/lib/embedding-provider.ts`, `item-vault-index.ts`                                        |
| DB tables                                | `src/db/schema.ts` (`items`, `item_embeddings`, …)                                            |


## Lore Q&A


| Concern                      | Location                                                   |
| ---------------------------- | ---------------------------------------------------------- |
| HTTP entry                   | `app/api/lore/query/route.ts`                              |
| Retrieval + answer synthesis | `src/lib/lore-engine.ts` (uses `vault-retrieval.ts`)       |
| Rate limit                   | `src/lib/lore-query-rate-limit.ts`                         |
| UI                           | `src/components/ui/LoreAskPanel.tsx`, `src/components/ui/LoreAskPanel.stories.tsx` |


## Lore import (smart import)


| Concern                                                      | Location                                                                                                |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Parse uploads                                                | `app/api/lore/import/parse/route.ts`                                                                    |
| Sync plan (blocking)                                         | `app/api/lore/import/plan/route.ts` → `src/lib/lore-import-plan-build.ts`                               |
| Async job enqueue + poll                                     | `app/api/lore/import/jobs/route.ts`, `jobs/[jobId]/route.ts` → `src/lib/lore-import-job-*.ts`           |
| Apply plan to canvas                                         | `app/api/lore/import/apply/route.ts`, `src/lib/lore-import-apply.ts`                                    |
| Space target lookup for review overrides                     | `app/api/spaces/search/route.ts`                                                                          |
| Apply: pending HTML wrappers + `entity_meta.aiReview`        | `src/lib/lore-import-apply.ts`, `lore-import-commit.ts`                                                 |
| Review persistence                                           | `src/lib/lore-import-persist-review.ts`                                                                 |
| Card layout (proximity / affinity-driven)                    | `src/lib/lore-import-placement.ts`                                                                      |
| Entity meta schema (typed `items.entity_meta`)               | `src/lib/entity-meta-schema.ts`                                                                         |
| Import link shape validator (coerce to canonical types)      | `src/lib/lore-import-link-shape.ts`                                                                     |
| Binding-hint promotion into `hgArch` slots                   | `src/lib/lore-import-apply-bindings.ts`, `src/lib/bindings-catalog.ts`                                  |
| Legacy routes (deprecated, gated by `HEARTGARDEN_IMPORT_LEGACY_ENABLED=1`) | `app/api/lore/import/extract/route.ts`, `app/api/lore/import/commit/route.ts`, `src/lib/heartgarden-import-legacy-gate.ts` |
| Plan types & Zod                                             | `src/lib/lore-import-plan-types.ts`                                                                     |
| Consistency check (LLM)                                      | `app/api/lore/consistency/check/route.ts`                                                               |


## Graph links (`item_links`)


| Concern                     | Location                                  |
| --------------------------- | ----------------------------------------- |
| CRUD API                    | `app/api/item-links/route.ts`             |
| Bulk sync from client graph | `app/api/item-links/sync/route.ts`        |
| Per-item neighbors          | `app/api/items/[itemId]/links/route.ts`   |
| Related items heuristic     | `app/api/items/[itemId]/related/route.ts` |


## Spaces & graph JSON


| Concern                                                                                       | Location                                     |
| --------------------------------------------------------------------------------------------- | -------------------------------------------- |
| List / create spaces                                                                          | `app/api/spaces/route.ts`                    |
| Patch rename / reparent / delete                                                              | `app/api/spaces/[spaceId]/route.ts`          |
| Delta sync (items + optional spaces / itemIds; **`itemLinksRevision`**)                         | `app/api/spaces/[spaceId]/changes/route.ts`  |
| Link revision only (`itemLinksRevision`)                                                      | `app/api/spaces/[spaceId]/link-revision/route.ts` |
| Ephemeral presence (peers, camera, pointer; boot access via `heartgarden-space-route-access`) | `app/api/spaces/[spaceId]/presence/route.ts` |
| Items in space                                                                                | `app/api/spaces/[spaceId]/items/route.ts`    |
| Graph export shape                                                                            | `app/api/spaces/[spaceId]/graph/route.ts`    |
| Summary (MCP / tooling)                                                                       | `app/api/spaces/[spaceId]/summary/route.ts`  |
| Space-wide reindex                                                                            | `app/api/spaces/[spaceId]/reindex/route.ts`  |


## Items


| Concern                    | Location                                |
| -------------------------- | --------------------------------------- |
| Patch / delete             | `app/api/items/[itemId]/route.ts`       |
| Clear stale embedding rows | `app/api/items/[itemId]/embed/route.ts` |
| Chunk + index (vault)      | `app/api/items/[itemId]/index/route.ts` |


## Media & webclip


| Concern                                  | Location                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| R2 presign                               | `app/api/upload/presign/route.ts`, `src/lib/r2-upload.ts`                                         |
| Display URL template (client-side media) | Env `**NEXT_PUBLIC_HEARTGARDEN_IMAGE_URL_TEMPLATE**` + `src/lib/heartgarden-image-display-url.ts` |
| Webclip preview fetch                    | `app/api/webclip/preview/route.ts`, `src/lib/webclip-preview.ts`                                  |


## Versioned read API (scripts)


| Concern               | Location                                                          |
| --------------------- | ----------------------------------------------------------------- |
| List items (v1 shape) | `app/api/v1/items/route.ts`, `app/api/v1/items/[itemId]/route.ts` |


## MCP


| Concern                        | Location                                                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Tool definitions & HTTP to app | `src/lib/mcp/heartgarden-mcp-server.ts`, `scripts/mcp-server.ts`, `scripts/mcp-prod-smoke.ts` (`npm run mcp:smoke`), `app/api/mcp/route.ts` |
| Write-guarded routes           | e.g. `write_key` on reindex / patch (see `docs/API.md`)                                                                                     |


## Tests & CI


| Concern | Location                                           |
| ------- | -------------------------------------------------- |
| Unit + route tests | `src/**/*.test.ts`, `app/api/**/*.test.ts`, `vitest.config.ts` |
| E2E     | `e2e/`, `playwright.config.ts`                     |
| Storybook | `src/components/**/*.stories.tsx`, `.storybook/` |
| Checks  | `npm run check`, `npm run check:all` (`AGENTS.md`) |


---

*Living document — extend when a new subsystem lands or an old path is retired.*