---
title: heartgarden — code map
status: canonical
audience: [agent, human]
last_reviewed: 2026-04-11
canonical: true
related:
  - vigil/docs/FEATURES.md
  - vigil/docs/API.md
---

# heartgarden — code map

High-level map from **feature / subsystem** to **primary files**. This does not list every symbol; use `docs/API.md` for HTTP routes and jump-to-definition for details. **Keep this file updated** when you add a new vertical (major API family, new sync path, or new shell concern).

## App shell & routing

| Concern | Location |
|--------|-----------|
| Next app root, global CSS | `app/layout.tsx`, `app/page.tsx`, `app/globals.css` |
| Client mount, boot gate | `app/_components/VigilApp.tsx` |
| Production canvas UI (graph state lives here) | `src/components/foundation/ArchitecturalCanvasApp.tsx` |
| Browser-local camera storage + arrival policy | `src/lib/heartgarden-space-camera.ts` (see **`AGENTS.md`** → Canvas camera) |
| Foundation types / pieces | `src/components/foundation/*` |
| Flow / WebGL overlay (optional) | `src/components/transition-experiment/VigilFlowRevealOverlay.tsx` |
| Legacy / parallel store (panels) | `src/stores/canvas-store.ts` (see `BUILD_PLAN.md`) |

## Canvas chrome, navigation & note editing

| Concern | Location |
|--------|-----------|
| Minimap + viewport metrics strip | `src/components/foundation/CanvasMinimap.tsx`, `ArchitecturalStatusBar.tsx` (`ArchitecturalViewportMetrics`), `src/lib/vigil-canvas-prefs.ts` |
| Fit camera / world bounds for UI | `src/lib/canvas-view-bounds.ts` |
| Default camera / `CameraState` | `src/model/canvas-types.ts` (`defaultCamera`) |
| Transient viewport toasts | `src/components/foundation/CanvasViewportToast.tsx` |
| Default/task note bodies (TipTap hgDoc) | `src/components/editing/HeartgardenDocEditor.tsx`, `src/lib/hg-doc/*`, `docs/EDITOR_HG_DOC.md` |
| **hgDoc `hgAiPending` mark, margin Bind, strip pending** | `src/lib/hg-doc/hg-ai-pending-mark.ts`, `collect-hg-ai-pending-ranges.ts`, `remove-hg-ai-pending-range.ts`, `strip-hg-ai-pending.ts`, `src/components/editing/HgAiPendingEditorGutter.tsx`, tests in `hg-ai-pending-mark.test.ts` |
| **Unreviewed / Accept** (`entity_meta.aiReview`, pending body detection) | `src/components/foundation/ArchitecturalNodeCard.tsx`, `ArchitecturalCanvasApp.tsx` (`acceptAiReviewForEntity`, `contentEntityHasHgAiPending`) |
| **Cmd+K palette** (search, actions, **lore create shortcuts**, export, …) | `src/components/foundation/ArchitecturalCanvasApp.tsx` (`paletteActions`, `runPaletteAction`), `src/components/ui/CommandPalette.tsx` |
| **Bottom dock** (create strip, lore layout flyouts for org/location) | `src/components/foundation/ArchitecturalBottomDock.tsx` (`DEFAULT_CREATE_ACTIONS`, `ArchitecturalCreateMenu`) |
| **Empty-canvas context menu** (lore creates on right-click empty viewport) | `ArchitecturalCanvasApp.tsx` (`canvasEmptyContextMenu`, `canvasEmptyContextMenuItems`, `handleViewportContextMenuCapture`) |
| Buffered rich text + wiki `[[` assist (lore, code, media captions) | `src/components/editing/BufferedContentEditable.tsx`, `WikiLinkAssistPopover.tsx`, `src/lib/wiki-link-caret.ts` |
| Resolved image URLs (zoom / CDN template) | `src/lib/heartgarden-image-display-url.ts` |
| Viewport culling (entities, stacks, connections) | `src/lib/canvas-viewport-cull.ts` |

## Lore canvas node variants (custom bodies, ID cards)

| Concern | Location |
|--------|-----------|
| **Patterns & checklist for new node types** | **`docs/CANVAS_LORE_NODE_PATTERNS.md`** |
| **Character focus + persistence / migration plan** | **`docs/CHARACTER_FOCUS_AND_DATA_MODEL_PLAN.md`** |
| Lore seed HTML, `loreCard`, body detection | `src/lib/lore-node-seed-html.ts` |
| Shared card markup CSS (portable `bodyHtml`) | `src/components/foundation/lore-entity-card.module.css` |
| Example: character v11 canvas shell | `src/components/foundation/ArchitecturalLoreCharacterCanvasNode.tsx` |
| Example: character focus = same `BufferedContentEditable` + `focusCharacterDocument` shell as default doc | `ArchitecturalCanvasApp.tsx`, `ArchitecturalCanvasApp.module.css` |

## Persistence (Neon) & canvas sync

| Concern | Location |
|--------|-----------|
| Hydrate / active space + items | `app/api/bootstrap/route.ts` → `src/lib/spaces.ts` |
| Client ↔ API bridge | `src/components/foundation/architectural-neon-api.ts`, `architectural-db-bridge.ts` |
| Delta poll + merge (space changes hook) | `src/hooks/use-heartgarden-space-change-sync.ts`, `src/lib/heartgarden-space-change-sync-utils.ts` |
| Sync status bus | `src/lib/neon-sync-bus.ts` |
| Undo / redo (in-memory) | `src/components/foundation/architectural-undo.ts` |
| Item row ↔ canvas shape | `src/lib/item-mapper.ts`, `src/model/canvas-types.ts` |
| Space subtree / camera | `src/lib/spaces.ts` |
| Subtree helper (presence GET) | `src/lib/heartgarden-space-subtree.ts` |
| Presence POST body validation | `src/lib/heartgarden-presence-body.ts` |
| Presence client + poll/heartbeat | `src/hooks/use-heartgarden-presence-heartbeat.ts`, `src/components/foundation/architectural-neon-api.ts`, `src/lib/heartgarden-collab-constants.ts` |
| Remote cursors + emoji identity | `src/components/foundation/ArchitecturalRemotePresenceLayer.tsx`, `src/lib/collab-presence-identity.ts` |

## Search & vault index

| Concern | Location |
|--------|-----------|
| FTS + fuzzy + hybrid RRF | `app/api/search/route.ts`, `src/lib/spaces.ts` (search helpers) |
| Suggest (palette) | `app/api/search/suggest/route.ts` |
| Raw chunk hits | `app/api/search/chunks/route.ts` |
| Hybrid retrieval (FTS + vector + fusion) | `src/lib/vault-retrieval.ts`, `vault-retrieval-rrf.ts` |
| Chunk + embed + lore meta on item | `app/api/items/[itemId]/index/route.ts`, `src/lib/item-vault-index.ts`, `lore-item-meta.ts` |
| Vault index UI status (status bar) | `src/lib/vault-index-status-bus.ts` → `ArchitecturalStatusBar.tsx` (`VaultIndexStatusInline`) |
| Debounced / `after()` reindex | `src/lib/schedule-vault-index-after.ts` |
| Embeddings provider | `src/lib/embedding-provider.ts`, `item-vault-index.ts` |
| DB tables | `src/db/schema.ts` (`items`, `item_embeddings`, …) |

## Lore Q&A

| Concern | Location |
|--------|-----------|
| HTTP entry | `app/api/lore/query/route.ts` |
| Retrieval + answer synthesis | `src/lib/lore-engine.ts` (uses `vault-retrieval.ts`) |
| Rate limit | `src/lib/lore-query-rate-limit.ts` |
| UI | `src/components/foundation/LoreAskPanel.tsx` (and related) |

## Lore import (smart import)

| Concern | Location |
|--------|-----------|
| Parse / extract uploads | `app/api/lore/import/parse/route.ts`, `extract/route.ts` |
| Sync plan (blocking) | `app/api/lore/import/plan/route.ts` → `src/lib/lore-import-plan-build.ts` |
| Async job enqueue + poll | `app/api/lore/import/jobs/route.ts`, `jobs/[jobId]/route.ts` → `src/lib/lore-import-job-*.ts` |
| Apply plan to canvas | `app/api/lore/import/apply/route.ts`, `src/lib/lore-import-apply.ts` |
| Commit / review persistence | `app/api/lore/import/commit/route.ts`, `src/lib/lore-import-commit.ts`, `lore-import-persist-review.ts` |
| Apply/commit: pending HTML wrappers + `entity_meta.aiReview` | `src/lib/lore-import-apply.ts`, `lore-import-commit.ts`, `app/api/lore/import/commit/route.ts` |
| Plan types & Zod | `src/lib/lore-import-plan-types.ts` |
| Consistency check (LLM) | `app/api/lore/consistency/check/route.ts` |

## Graph links (`item_links`)

| Concern | Location |
|--------|-----------|
| CRUD API | `app/api/item-links/route.ts` |
| Bulk sync from client graph | `app/api/item-links/sync/route.ts` |
| Per-item neighbors | `app/api/items/[itemId]/links/route.ts` |
| Related items heuristic | `app/api/items/[itemId]/related/route.ts` |

## Spaces & graph JSON

| Concern | Location |
|--------|-----------|
| List / create spaces | `app/api/spaces/route.ts` |
| Patch camera / rename / delete | `app/api/spaces/[spaceId]/route.ts` |
| Delta sync (items + optional spaces / itemIds) | `app/api/spaces/[spaceId]/changes/route.ts` |
| Ephemeral presence (peers, camera, pointer; boot access via `heartgarden-space-route-access`) | `app/api/spaces/[spaceId]/presence/route.ts` |
| Items in space | `app/api/spaces/[spaceId]/items/route.ts` |
| Graph export shape | `app/api/spaces/[spaceId]/graph/route.ts` |
| Summary (MCP / tooling) | `app/api/spaces/[spaceId]/summary/route.ts` |
| Space-wide reindex | `app/api/spaces/[spaceId]/reindex/route.ts` |

## Items

| Concern | Location |
|--------|-----------|
| Patch / delete | `app/api/items/[itemId]/route.ts` |
| Clear stale embedding rows | `app/api/items/[itemId]/embed/route.ts` |
| Chunk + index (vault) | `app/api/items/[itemId]/index/route.ts` |

## Media & webclip

| Concern | Location |
|--------|-----------|
| R2 presign | `app/api/upload/presign/route.ts`, `src/lib/r2-upload.ts` |
| Display URL template (client-side media) | Env **`NEXT_PUBLIC_HEARTGARDEN_IMAGE_URL_TEMPLATE`** + `src/lib/heartgarden-image-display-url.ts` |
| Webclip preview fetch | `app/api/webclip/preview/route.ts`, `src/lib/webclip-preview.ts` |

## Versioned read API (scripts)

| Concern | Location |
|--------|-----------|
| List items (v1 shape) | `app/api/v1/items/route.ts`, `app/api/v1/items/[itemId]/route.ts` |

## MCP

| Concern | Location |
|--------|-----------|
| Tool definitions & HTTP to app | `src/lib/mcp/heartgarden-mcp-server.ts`, `scripts/mcp-server.ts`, `app/api/mcp/route.ts` |
| Write-guarded routes | e.g. `write_key` on reindex / patch (see `docs/API.md`) |

## Tests & CI

| Concern | Location |
|--------|-----------|
| Unit | `src/**/*.test.ts`, `vitest.config.ts` |
| E2E | `e2e/`, `playwright.config.ts` |
| Checks | `npm run check`, `npm run check:all` (`AGENTS.md`) |

---

*Living document — extend when a new subsystem lands or an old path is retired.*
