# heartgarden — code map

High-level map from **feature / subsystem** to **primary files**. This does not list every symbol; use `docs/API.md` for HTTP routes and jump-to-definition for details. **Keep this file updated** when you add a new vertical (major API family, new sync path, or new shell concern).

## App shell & routing

| Concern | Location |
|--------|-----------|
| Next app root, global CSS | `app/layout.tsx`, `app/page.tsx`, `app/globals.css` |
| Client mount, boot gate | `app/_components/VigilApp.tsx` |
| Production canvas UI (graph state lives here) | `src/components/foundation/ArchitecturalCanvasApp.tsx` |
| Foundation types / pieces | `src/components/foundation/*` |
| Flow / WebGL overlay (optional) | `src/components/transition-experiment/VigilFlowRevealOverlay.tsx` |
| Legacy / parallel store (panels) | `src/stores/canvas-store.ts` (see `BUILD_PLAN.md`) |

## Persistence (Neon) & canvas sync

| Concern | Location |
|--------|-----------|
| Hydrate / active space + items | `app/api/bootstrap/route.ts` → `src/lib/spaces.ts` |
| Client ↔ API bridge | `src/components/foundation/architectural-neon-api.ts`, `architectural-db-bridge.ts` |
| Sync status bus | `src/lib/neon-sync-bus.ts` |
| Undo / redo (in-memory) | `src/components/foundation/architectural-undo.ts` |
| Item row ↔ canvas shape | `src/lib/item-mapper.ts`, `src/model/canvas-types.ts` |
| Space subtree / camera | `src/lib/spaces.ts` |

## Search & vault index

| Concern | Location |
|--------|-----------|
| FTS + fuzzy + hybrid RRF | `app/api/search/route.ts`, `src/lib/spaces.ts` (search helpers) |
| Suggest (palette) | `app/api/search/suggest/route.ts` |
| Raw chunk hits | `app/api/search/chunks/route.ts` |
| Hybrid retrieval (FTS + vector + fusion) | `src/lib/vault-retrieval.ts`, `vault-retrieval-rrf.ts` |
| Chunk + embed + lore meta on item | `app/api/items/[itemId]/index/route.ts`, `src/lib/item-vault-index.ts`, `lore-item-meta.ts` |
| Debounced / `after()` reindex | `src/lib/schedule-vault-index-after.ts` |
| Embeddings provider | `src/lib/embedding-provider.ts`, `item-embedding.ts` |
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
| Webclip preview fetch | `app/api/webclip/preview/route.ts`, `src/lib/webclip-preview.ts` |

## Versioned read API (scripts)

| Concern | Location |
|--------|-----------|
| List items (v1 shape) | `app/api/v1/items/route.ts`, `app/api/v1/items/[itemId]/route.ts` |

## MCP

| Concern | Location |
|--------|-----------|
| Tool definitions & HTTP to app | `scripts/mcp-server.mjs` |
| Write-guarded routes | e.g. `write_key` on reindex / patch (see `docs/API.md`) |

## Tests & CI

| Concern | Location |
|--------|-----------|
| Unit | `src/**/*.test.ts`, `vitest.config.ts` |
| E2E | `e2e/`, `playwright.config.ts` |
| Checks | `npm run check`, `npm run check:all` (`AGENTS.md`) |

---

*Living document — extend when a new subsystem lands or an old path is retired.*
