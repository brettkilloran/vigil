# Data pipeline audit vs original app intent

Date: 2026-04-11  
Audience: product design + engineering  
Scope: full pipeline (bootstrap, CRUD, links, sync, presence, index/search/lore, import, MCP)  
**Index:** listed under [HEARTGARDEN_MASTER_PLAN.md](HEARTGARDEN_MASTER_PLAN.md) (canonical pointers table).

## 1) Purpose and feature narrative

Heartgarden's core intent remains a spatial knowledge canvas: capture notes/entities, organize them in folders/spaces, connect ideas with links, and retrieve/synthesize context quickly. The app has evolved from "personal only" into a multi-mode shell that now serves:

- persisted GM workspace (Neon-backed)
- demo/local fallback mode (no Neon required)
- player-scoped multiplayer workspace with strict server-side bounds

The data pipeline is the product. The experience quality depends on whether each stage preserves intent:

1. ingest data (bootstrap/import/manual edits)
2. persist correctly (items/spaces/links)
3. sync safely across clients (changes/presence/conflicts)
4. index/retrieve reliably (search + lore query)
5. classify and organize complex imported lore into correct node/object types

The highest risk is not one endpoint; it is drift between these stages when running multiple modes in the same shell.

## 2) Executive verdict

- **Overall:** `partial alignment` with original intent.
- **Strongly aligned:** server-side access scoping for players, bootstrap + merge contracts, guarded delta parsing, search fallback behavior, explicit non-CRDT collab semantics.
- **Partially aligned / risky:** lore import maturity (type coverage + placement + merge correctness under live edits), mode-boundary bleed checks, and registry cohesion between UI node types vs import/search vocabularies.
- **Strategic gap (known):** desired Figma-like consistency vs shipped polling + server-row merge model.

## 2a) Chat asks → verified evidence → status

Every theme raised in the conversation thread is mapped here so nothing stays implicit.

| Chat ask | Evidence reviewed | Status | Next action |
| --- | --- | --- | --- |
| App evolved from personal-only to **demo + player multiplayer** in one shell; **bleed** and sync/streaming bugs | [`app/api/bootstrap/route.ts`](../app/api/bootstrap/route.ts), [`heartgarden-api-boot-context.ts`](../src/lib/heartgarden-api-boot-context.ts), [`PLAYER_LAYER.md`](PLAYER_LAYER.md), [`heartgarden-space-camera.ts`](../src/lib/heartgarden-space-camera.ts), `persistNeonRef` / demo branches in [`ArchitecturalCanvasApp.tsx`](../src/components/foundation/ArchitecturalCanvasApp.tsx) | **partial** | Keep three-track smoke (§4); optional future: namespace `localStorage` keys by boot tier/session id to reduce profile-level confusion |
| **Figma-like** multiplayer consistency vs what ships today | [`use-heartgarden-space-change-sync.ts`](../src/hooks/use-heartgarden-space-change-sync.ts), [`heartgarden-space-change-sync-utils.ts`](../src/lib/heartgarden-space-change-sync-utils.ts), [`spaces/[spaceId]/changes/route.ts`](../app/api/spaces/[spaceId]/changes/route.ts), [`BUILD_PLAN.md`](BUILD_PLAN.md) (E2/E3 backlog), [`AGENTS.md`](../AGENTS.md) (non-CRDT) | **gap (architectural)** | See §12 decision brief; separate bug fixes from roadmap |
| **Lore import** must synthesize, sort/organize, pick node types, layout on canvas, **create vs populate** existing | [`lore-import-plan-build.ts`](../src/lib/lore-import-plan-build.ts), [`lore-import-plan-llm.ts`](../src/lib/lore-import-plan-llm.ts), [`lore-import-apply.ts`](../src/lib/lore-import-apply.ts), [`app/api/lore/import/`](../app/api/lore/import/) (`plan`, `apply`, `commit` routes) | **partial** | Conformance tests; tighten mapping from `canonicalEntityKind` → persisted `entity_type` + `hgArch` / card templates |
| **New object types** visible to search + import LLM organization | [`lore-import-canonical-kinds.ts`](../src/lib/lore-import-canonical-kinds.ts), [`lore-node-seed-html.ts`](../src/lib/lore-node-seed-html.ts), [`buildSearchBlob`](../src/lib/search-blob.ts), [`app/api/search/route.ts`](../app/api/search/route.ts) | **partial** | Maintain single registry (§6 + backlog §13); add tests when adding a kind |
| **Designer-readable** narrative + **E2E smoke** without full prior E2E | §1, §4, this table | **documented** | Run §4 manually when changing shell/sync/import |
| **Check it all** (full pipeline audit) | §5–§9, traceability §7 | **done (this doc)** | Re-run when shipping major vertical changes |

## 3) Canonical rubric used

Tier A (as shipped): `AGENTS.md`, `docs/API.md`, `docs/FEATURES.md`, `docs/CODEMAP.md`, `docs/BUILD_PLAN.md`  
Tier B (intent/history): `docs/STRATEGY.md`, `docs/archive/vigil-master-plan-legacy.md`, `docs/archive/FUNCTIONAL_PRD_REBUILD.md`, `docs/LORE_ENGINE_ROADMAP.md`

Pass/fail invariants tested against code:

- items are server SoT
- viewport is browser-local and not server-authoritative
- players are scope-limited server-side, fail-closed
- collab is polling + 409 conflict handling (not CRDT)
- tombstone correctness depends on full `itemIds` snapshots

## 4) Three-track E2E smoke playbook

Run from `vigil/` with `npm run dev`.

### Track A: Neon workspace (GM/full)

1. Boot and open workspace; confirm non-demo bootstrap (`/api/bootstrap` returns `demo: false` and `spaceId` set).
2. Create note, checklist, folder; edit title/body; move one card.
3. Create a link between two cards; confirm graph edge appears in `/api/spaces/:id/graph`.
4. Open second tab on same space:
  - edit item A in tab 1, see merge in tab 2
  - delete item B in tab 1, ensure tab 2 reconciles after immediate/visibility poll
5. Trigger 409 path:
  - patch same item concurrently from both tabs, verify server-version conflict handling.
6. Run search:
  - lexical query always works
  - semantic/hybrid vector behavior depends on embeddings being configured (`src/lib/embedding-provider.ts`).
7. Ask lore (`/api/lore/query`) with `ANTHROPIC_API_KEY` set.
8. Import lore (`plan -> apply -> commit`), verify:
  - created cards appear in expected folder/layout
  - merge proposals behave as accepted
  - new content appears in search/lore after index path completes.

Watch-for symptoms: duplicate cards, missed tombstone deletes, stale folder parent mapping, incorrect import target space.

### Track B: Demo/local fallback

1. Force demo path (no DB configured or `PLAYWRIGHT_E2E=1` behavior).
2. Confirm shell enters local/demo graph seed and does not attempt Neon persistence.
3. Ensure creating/editing cards does not emit persistent cloud expectations in UX.
4. Confirm lore/import/vault functions that require GM/DB/key surfaces behave as unavailable/forbidden instead of silently corrupting local state.

Watch-for symptoms: partial cloud UI shown in demo, confusing "saved" semantics, stale persisted assumptions.

### Track C: Player-tier scoped workspace

1. Enter Players PIN tier and verify boot/session tier is `player`.
2. Confirm bootstrap returns only player subtree.
3. Validate allowed operations:
  - notes/checklists/folders allowed
  - media/lore/import/reindex-style GM routes forbidden.
4. Confirm random out-of-scope UUIDs return generic forbidden behavior (no existence leak).
5. Confirm links within player subtree can be created and graphed.
6. Confirm search scope stays player-bounded.
7. Open second player tab and verify collab behavior remains scoped.

Watch-for symptoms: scope bleed into GM spaces, import/search operating outside player subtree, privileged entity meta keys accepted.

### 4.1) Per-track detail and failure heuristics

| Signal | Likely cause | Where to look |
| --- | --- | --- |
| Sync line stuck on error after tab return | change poll parse failure / missing `itemIds` when required | [`fetchSpaceChanges`](../src/components/foundation/architectural-neon-api.ts), [`parseSpaceChangesResponseJson`](../src/lib/heartgarden-space-change-sync-utils.ts) |
| Card deleted on server still visible locally | tombstone merge skipped or stale cursor | [`mergeRemoteItemPatches`](../src/components/foundation/architectural-db-bridge.ts), `syncCursorRef` |
| Wrong folder after peer reparent | space rows not merged | [`mergeRemoteSpaceRowsIntoGraph`](../src/components/foundation/architectural-db-bridge.ts), changes route `spaces` payload |
| Demo session shows cloud affordances | `persistNeonRef` true or UI not gated by tier | [`ArchitecturalCanvasApp.tsx`](../src/components/foundation/ArchitecturalCanvasApp.tsx), [`PLAYER_LAYER.md`](PLAYER_LAYER.md) matrix |
| Player can open lore/import | boot tier not enforced on route | `enforceGmOnlyBootContext` on lore/import routes |
| Import cards stack on top of each other | layout origin / grid in [`lore-import-apply.ts`](../src/lib/lore-import-apply.ts) | apply body `layout.originX/Y`, `planLoreImportCardLayout` |
| Imported “npc” looks like plain note | canonical kind not mapped to lore card shell | [`canvasItemToEntity`](../src/components/foundation/architectural-db-bridge.ts), [`getLoreNodeSeedBodyHtml`](../src/lib/lore-node-seed-html.ts) |

## 5) Cross-mode bleed matrix


| Mechanism                                      | Neon GM                             | Demo/local                               | Player tier                                    | Risk        |
| ---------------------------------------------- | ----------------------------------- | ---------------------------------------- | ---------------------------------------------- | ----------- |
| Bootstrap branch (`/api/bootstrap`)            | full workspace resolution           | `demo: true` fallback when no DB / E2E   | subtree-rooted by boot context                 | medium      |
| Persistence toggle (`persistNeonRef`)          | true after cloud bootstrap          | false                                    | false for blocked paths; scoped allowed writes | medium      |
| Change sync polling                            | active + include `itemIds` contract | effectively no cloud changes             | active, scoped by access layer                 | medium-high |
| Presence                                       | optional `canvas_presence`          | no-op in E2E path                        | scoped, rate-limited, subtree checks           | medium      |
| Camera storage (`heartgarden-space-camera-v1`) | shared browser localStorage key     | same key family                          | same key family                                | medium-high |
| Presence client id (`sessionStorage`)          | per-tab id                          | same                                     | same                                           | low         |
| Import `spaceId` target                        | explicit + GM only route            | unavailable                              | forbidden                                      | high        |
| Search scope policy                            | full with optional filters          | likely empty/local fallback expectations | forced player scope                            | high        |


## 6) Object-type registry (UI -> persistence -> import -> retrieval)


| Concern                          | Current implementation                                                                                         | Alignment | Gap/Risk                                                                                           |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------- |
| Base item types                  | DB `items.item_type` supports note/sticky/image/checklist/webclip/folder                                       | aligned   | none                                                                                               |
| Lore card kinds in canvas chrome | `loreCard.kind` effectively character/faction/location in card templates                                       | partial   | import canonical kinds include npc/quest/item/lore/other that do not map to dedicated lore card UI |
| Entity discriminator             | DB `entity_type` free string + `entity_meta` jsonb                                                             | partial   | no strict enum means drift between import output and UI render affordances                         |
| Import canonical taxonomy        | `CANONICAL_ENTITY_KINDS`: npc/location/faction/quest/item/lore/other                                           | partial   | only subset has specialized canvas rendering; others collapse to generic note behavior             |
| Import target item type          | schema allows `targetItemType`, plan build currently sets null for new notes and candidate itemType for merges | partial   | limited exploitation of target item type for organizing output forms                               |
| Search indexing fields           | `buildSearchBlob` includes title/content/contentJson/entityType/entityMeta/lore summary/aliases                | aligned   | quality depends on entity type consistency and meta hygiene                                        |
| Lore retrieval                   | hybrid retrieval + synthesis; no strong type-aware ranking contract                                            | partial   | new node/object classes may not get intended retrieval weighting                                   |
| MCP tools                        | broad read/write/search/index suite; write key for mutating tools                                              | aligned   | no explicit object-type validation layer in MCP abstractions                                       |


## 7) Traceability matrix (doc intent -> code entrypoints -> verdict)


| Pipeline stage           | Intent refs                              | Primary code paths                                                                                                                      | Verdict | Notes                                                                                |
| ------------------------ | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------ |
| Hydration/bootstrap      | `API.md`, `AGENTS.md`, `PLAYER_LAYER.md` | `app/api/bootstrap/route.ts`, `spaces.ts`, `buildCanvasGraphFromBootstrap`, `mergeBootstrapView`                                        | aligned | good demo/player/GM branching and subtree semantics                                  |
| Client->server mutations | `FEATURES.md`, `API.md`                  | `ArchitecturalCanvasApp.tsx`, `architectural-neon-api.ts`, `app/api/items/[itemId]/route.ts`, `app/api/spaces/[spaceId]/items/route.ts` | aligned | serialized patch chain and sync bus improve UX stability                             |
| Links pipeline           | `API.md`, `STRATEGY.md`                  | `app/api/item-links/route.ts`, `item-links/sync/route.ts`, `spaces/[id]/graph/route.ts`                                                 | aligned | validates link target space consistency                                              |
| Delta sync + tombstones  | `API.md`, `PLAYER_LAYER.md`              | `use-heartgarden-space-change-sync.ts`, `heartgarden-space-change-sync-utils.ts`, `spaces/[id]/changes/route.ts`                        | aligned | strict `itemIds` requirement when requested is strong                                |
| Presence                 | `API.md`, `PLAYER_LAYER.md`              | `spaces/[id]/presence/route.ts`, presence hooks/clients                                                                                 | partial | robust scoping/rate-limit; still polling-tier consistency ceiling                    |
| Search                   | `API.md`, `FEATURES.md`                  | `app/api/search/route.ts`, `search-blob.ts`, `spaces.ts` helpers                                                                        | aligned | clear lexical fallback when embeddings absent                                        |
| Vault index              | `BUILD_PLAN.md`, `AGENTS.md`             | `item-vault-index.ts`, `items/[id]/index`, `schedule-vault-index-after.ts`, client debounce                                             | partial | dual trigger model (client debounce + optional after()) needs operational discipline |
| Lore query               | `API.md`, `BUILD_PLAN.md`                | `app/api/lore/query/route.ts`, `lore-engine.ts`, retrieval helpers                                                                      | aligned | GM-only and keyed behavior explicit                                                  |
| Lore import plan         | `LORE_ENGINE_ROADMAP.md`, import docs    | `lore-import-plan-build.ts`, `lore-import-plan-llm.ts`, `app/api/lore/import/plan/route.ts`                                             | partial | advanced flow exists, but taxonomy/UI mapping not fully cohesive                     |
| Lore import apply/commit | same                                     | `lore-import-apply.ts`, `app/api/lore/import/apply/route.ts`, `commit/route.ts`                                                         | partial | create/merge/link mechanisms exist; layout/merge race regressions remain plausible   |
| MCP tools                | `AGENTS.md` MCP section                  | `src/lib/mcp/heartgarden-mcp-server.ts`, `app/api/mcp/route.ts`                                                                                                                | aligned | tool coverage is broad and write-key guarded                                         |


## 8) Coverage snapshot (tests present)

High-value coverage exists for bridge and sync merge contracts:

- `architectural-db-bridge.hgdoc.test.ts`
- `architectural-db-bridge.merge-remote.test.ts`
- `heartgarden-space-change-sync-utils.test.ts`
- `player-item-policy.test.ts`

Notably thinner (or absent in this pass): deep import E2E behavior around merge/create/layout races, and object-type registry conformance tests across import -> search -> UI rendering.

## 9) Gap / risk register (severity-ordered)

### Critical

1. **Import type-model drift risk**
  - Import taxonomy (`npc/location/faction/quest/item/lore/other`) is richer than specialized lore card rendering (mostly character/faction/location).
  - Effect: imported content can be semantically classified but visually/search-organizationally underexpressed.
  - Impact: "underbaked import" perception and weak trust in automated organization.
2. **Mode-boundary bleed risk in shared shell**
  - Same shell paths serve GM/demo/player; storage keys and UX assumptions are global (`heartgarden-space-camera-v1`, per-tab presence ids).
  - Effect: wrong expectations and potential operator confusion when switching tiers/modes in same browser profile.

### High

1. **Multiplayer consistency gap vs desired Figma-like behavior**
  - Current architecture is intentionally polling + server-wins + conflict mediation, not CRDT/OT.
  - Effect: visible temporal inconsistency windows under rapid concurrent edits.
  - This is strategic/architectural, not a simple bug.
2. **Import apply/merge race potential**
  - Merge proposals + append strategies execute against live data and can intersect with concurrent edits/delta updates.
  - Effect: duplicate or awkwardly merged narratives if timing and acceptance handling drift.
3. **Registry governance gap**
  - No single enforced registry proving each new object type is wired through UI render, import prompts/schemas, search blob, lore retrieval weighting, and MCP semantics.
  - Effect: "silent" feature incompleteness for new node types.

### Medium

1. **Operational split-brain for indexing**
  - Client debounced index and optional server `after()` reindex can behave differently per environment.
  - Effect: inconsistent freshness expectations for search/lore after edits/import.
2. **Cross-mode smoke testing not codified as one regular gate**
  - Existing docs are strong, but no single recurring checklist is enforced in CI for Neon/demo/player behavior deltas.

## 10) Recommended next execution tranche

1. **Adopt a single object-type registry file** (source of truth) and validate it in tests:
  - import canonical kinds
  - UI render predicates
  - search/index field mapping
  - MCP exposure rules
2. **Add import pipeline conformance tests**:
  - plan output taxonomy validity
  - apply layout non-overlap/stability
  - create-vs-merge determinism
  - post-apply search visibility
3. **Institutionalize 3-track smoke run** (GM/demo/player) as release checklist.
4. **Separate strategic multiplayer roadmap from bug backlog**:
   - keep current polling path robust (E2/E3 style improvements)
   - document what "Figma-like" would require before promising behavior changes.

**Execution plan (tracks + YAML todos):** [`.cursor/plans/data_pipeline_import_hardening.plan.md`](../../.cursor/plans/data_pipeline_import_hardening.plan.md) (repo root `.cursor/plans/`).

## 12) Multiplayer consistency — decision brief (Figma-like vs shipped)

**Shipped model (evidence):** polling `GET …/changes` with optional full subtree `itemIds`, server rows as truth, `409` on optimistic concurrency, draft protection for focus/inline dirty ids — not CRDT/OT ([`AGENTS.md`](../AGENTS.md), [`PLAYER_LAYER.md`](PLAYER_LAYER.md)).

| Option | What it would improve | Cost / risk | Fit for heartgarden today |
| --- | --- | --- | --- |
| **A — Harden polling path** | Fewer missed deletes, clearer recovery (cursor invalid, bootstrap repair already sketched in hooks) | Low engineering; bounded by poll interval | **Recommended near-term** — aligns with [`BUILD_PLAN.md`](BUILD_PLAN.md) E2/E3 style deltas |
| **B — Server-push / SSE / WebSocket** | Lower latency edits, fewer “stale window” feels | Infra + auth + reconnect semantics + Vercel constraints | Medium-term; product decision on ops complexity |
| **C — CRDT / OT on item bodies** | Google-Docs-style merged typing | High complexity; conflicts with HTML/hgDoc + pin graph model | **Strategic** only; contradicts current “server row wins” simplicity |
| **D — Operational transform light** | Single-field linear merge | Medium; still needs schema discipline | Possible for title-only or plain-text paths only |

**Recommendation:** treat **A** as the default backlog; document **B** as optional when “feels live” is a top-level KPI; **C** only after explicit product charter (months+). Keep UX honest: no promise of Figma-class consistency until **B** or **C** is chosen.

## 13) Execution-ready backlog (P0 / P1 / P2)

Use this as a sprint board. Each item ties to §9 risks or §2a asks.

### P0 — correctness / trust

| ID | Item | Acceptance criteria | Test gate |
| --- | --- | --- | --- |
| P0-1 | **Import kind → render mapping** | For each `CANONICAL_ENTITY_KIND`, document expected `item_type` + `entity_type` + whether a lore card shell is applied; no silent generic note where a specialized shell exists | Unit tests on mapping helper; Storybook or lab page spot-check |
| P0-2 | **Change sync contract** | If `includeItemIds=1` requested, malformed responses trigger repair path without silent partial merge | Extend [`heartgarden-space-change-sync-utils.test.ts`](../src/lib/heartgarden-space-change-sync-utils.test.ts) |
| P0-3 | **Player scope** | No lore/import/reindex on player tier; 403 + no existence leak | [`PLAYER_LAYER.md`](PLAYER_LAYER.md) regression checklist |

### P1 — product polish + coverage

| ID | Item | Acceptance criteria | Test gate |
| --- | --- | --- | --- |
| P1-1 | **Single object-type registry module** | One exported map: kind → UI predicate, import prompt line, search filter key if any | Lint/test: new kind must register |
| P1-2 | **Import apply stress** | Apply with concurrent simulated PATCH in tests; merges remain deterministic or surface conflict | Integration test with mocked DB |
| P1-3 | **Index freshness** | Document when client debounce vs `after()` reindex runs; env matrix in [`VERCEL_ENV_VARS.md`](VERCEL_ENV_VARS.md) cross-link | Manual + optional e2e |

### P2 — strategic / nice-to-have

| ID | Item | Acceptance criteria | Test gate |
| --- | --- | --- | --- |
| P2-1 | **Namespaced camera storage** | Optional `localStorage` key prefix by session tier or workspace id | Manual cross-tier switch test |
| P2-2 | **Multiplayer roadmap doc** | ADR or `docs/` page choosing A vs B vs C from §12 | Review |
| P2-3 | **CI three-track smoke** | Scripted smoke (where env allows) for GM + E2E demo + player | GHA optional job |

## 14) Completion criteria (full-scope coverage plan)

The full-scope plan is **closed** when:

1. Every row in **§2a** has status **documented**, **done**, or **partial/gap** with a **next action** assigned (this doc satisfies that).
2. **§12** records the multiplayer strategy choice (or explicit deferral to P2-2).
3. **§13** backlog is tracked in issue tracker (GitHub/Vercel) with P0 items scheduled.
4. **§4.1** smoke heuristics are run once after each major merge touching shell, sync, or import.

## 11) Commands for follow-up verification

From `vigil/`:

- `npm run check`
- `npm run test:unit`
- targeted `npm run test:e2e` scenarios for sync/import/player scoping paths