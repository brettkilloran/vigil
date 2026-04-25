---
title: heartgarden — backlog (single source of truth)
status: canonical
audience: [agent, human]
last_reviewed: 2026-04-23
canonical: true
related:
  - heartgarden/AGENTS.md
  - heartgarden/docs/BUILD_PLAN.md
  - heartgarden/docs/FOLLOW_UP.md
  - heartgarden/docs/GO_LIVE_REMAINING.md
  - .cursor/skills/backlog/SKILL.md
  - .cursor/skills/backlog/SCORING.md
---

# heartgarden — backlog (SOT)

**This file is the single source of truth for open engineering backlog.** Any agent or human looking for "what's next to build" should start here.

## Scope

**In scope (lives here):**

- Hardening, parity, and feature items waiting to be picked up.
- `NET_NEW` overflow from `/review-*` runs (see `.cursor/skills/review-common/CLOSURE_POLICY.md` → "NET_NEW Feature Overflow → Backlog").
- Cross-cutting code-health audits (pointer rows — the audit docs themselves track progress).
- Items migrated from older, scattered sources during the 2026-04-23 consolidation.

**Out of scope (canonical homes elsewhere):**

| Concern | Canonical doc |
|---------|---------------|
| Human / keys / infra / dashboard work | [`FOLLOW_UP.md`](./FOLLOW_UP.md) |
| Deploy / release-gate runbook | [`GO_LIVE_REMAINING.md`](./GO_LIVE_REMAINING.md) |
| Shipped-tranches history + architecture snapshot | [`BUILD_PLAN.md`](./BUILD_PLAN.md) |
| Execution plans (YAML todos, code sketches, per-feature narratives) | [`.cursor/plans/`](../../.cursor/plans/README.md) — **optional** engineering notes, not the backlog of record |
| Env matrix | [`VERCEL_ENV_VARS.md`](./VERCEL_ENV_VARS.md) |
| Audit-dated cross-cutting backlog | [`CODE_HEALTH_AUDIT_2026-04-21.md`](./CODE_HEALTH_AUDIT_2026-04-21.md) and future `REVIEW_*.md` / audit docs |

Those files cross-link back to this one. If you find a new engineering item in FOLLOW_UP / GO_LIVE / an old review, move it here and leave a `<!-- moved-to: docs/BACKLOG.md#<anchor> ... -->` breadcrumb at the original.

## How items are added

- **Agents:** `/backlog` writes new items, DNF edits, and score-cache comments **here**. Old sources are still scanned (so nothing is orphaned) but writes always land in this file. See [`.cursor/skills/backlog/SKILL.md`](../../.cursor/skills/backlog/SKILL.md) §2.
- **Reviews:** `/review-heavy` and `/review-light` file `NET_NEW` overflow items under `## Review-sourced backlog` below.
- **Humans:** just append a bullet in the right section. Cite a file:line if possible so future triage can score it quickly.

**Score cache + DNF comment format:** [`.cursor/skills/backlog/SCORING.md`](../../.cursor/skills/backlog/SCORING.md).

## How items leave

- **Shipped:** add a row to `BUILD_PLAN.md` "Completed tranches" (brief line + commit ref if handy), then remove from this file.
- **DNF / out-of-scope:** apply the DNF shape from SCORING.md and move the item under `## Archive` at the bottom. Do not delete — keep history.

---

## Near-term — hardening & parity

<!-- migrated-from: docs/BUILD_PLAN.md §Near-term — hardening & parity on 2026-04-23 -->

1. **`POST /api/lore/query` hardening** — Baseline in-memory rate limit is shipped; before a public URL add auth, edge firewall, or Redis / Vercel KV for global limits.
2. **Index + embedding ops** — Tune HNSW / IVFFLAT on Neon. Server **`after()`** vault reindex on item PATCH/create (`schedule-vault-index-after.ts`) is **default on**; set **`HEARTGARDEN_INDEX_AFTER_PATCH=0`** to disable. Add a global queue if volume still exceeds debounced client + reindex.
3. **E2E** — Optional: palette → lore panel smoke (skip or mock LLM in CI).
4. **Canvas version history (UX2 — decision for v1)** — **Export-first:** the canvas already supports **Export graph JSON** (Cmd+K). Treat that as the supported "checkpoint" workflow until a DB snapshot or `item_revisions` table is justified. **Space / graph snapshots** and **per-item revision logs** remain future options; any in-app restore must not silently fight the local undo stack (explicit "restore from server snapshot" only).
5. **Space nav hardening (residual)** — **`enterSpace`** already uses a **generation guard** so stale fetches do not apply. Optional: **abort** in-flight bootstrap fetch on newer navigation, or a **short CSS-only** nav cue when canvas effects are **off** for parity with the WebGL transition.
6. **Collab delta API (beyond full `itemIds` every poll)** — Optional next tracks: **E2** tombstones / `deleted_item_ids` since cursor; **E3** monotonic subtree revision so thin clients never re-enumerate full id sets on recovery. The **official shell** already sends **`includeItemIds=1`** every poll (`docs/API.md`); lighter integrations may omit it.

---

## Lore import + data pipeline

<!-- migrated-from: docs/BUILD_PLAN.md §Near-term (lore import tranche) on 2026-04-23 -->

- **Audit source:** [`DATA_PIPELINE_AUDIT_2026-04-11.md`](./DATA_PIPELINE_AUDIT_2026-04-11.md) §10–§12 (registry, conformance tests, smoke gate, multiplayer expectations).
- **Execution tracks + YAML todos:** [`.cursor/plans/data_pipeline_import_hardening.plan.md`](../../.cursor/plans/data_pipeline_import_hardening.plan.md).
- **Canonical kind → DB / canvas mapping:** [`LORE_IMPORT_KIND_MAPPING.md`](./LORE_IMPORT_KIND_MAPPING.md) — code: `src/lib/lore-object-registry.ts`.

### Post-granularity rollout backlog

- `.html` file upload parser (Readability + jsdom) as a separate tranche.
- URL import (`fetch` + SSRF guardrails, content-type routing, auth-wall/SPA failure UX).
- Granular reshuffle controls in review (rename/delete/reassign) if product demand appears after v1.
- AI-assisted reshuffle prompt (`reorganize by X`) only if manual mode toggles prove insufficient.
- **Explicit non-goal:** OCR ingestion is intentionally not planned (quality risk + bundle/runtime overhead). If revisited, scope it as a dedicated feature with cloud OCR and map-specific UX, not generic import.

---

## Mid-term — master plan Phase 5 (TTRPG + intelligence)

<!-- migrated-from: docs/BUILD_PLAN.md §Mid-term on 2026-04-23 -->
<!-- consolidated 2026-04-25: legacy Phase 5 sub-bullets (auto-linking, lore consistency checker, deeper graph/timeline integration) collapsed into the unified Floating Ask Lore Bar entry below. Markdown bulk import lives in §Lore import + data pipeline above. -->

Phase 5 unifies under a single intelligence surface — one `⌘K` modal that exposes search, graph reasoning, auto-linking, and consistency checking through both an interactive UI and the MCP tool list. Legacy bullets (auto-linking beyond `[[` assist, lore consistency checker, deeper graph/timeline integration with persisted `item_links`) are facets of the same plan rather than independent tracks; they're all addressed by the entry below. Markdown bulk import + entity extraction is a genuinely separate tranche and is tracked under [`Lore import + data pipeline`](#lore-import--data-pipeline) above.

### Floating Ask Lore Bar (unified command palette + agentic LLM) — *FEATURE · L · plan: `floating_ask_lore_bar`*

**Plan:** [`.cursor/plans/floating_ask_lore_bar_fb090fd3.plan.md`](../../.cursor/plans/floating_ask_lore_bar_fb090fd3.plan.md) (14 todos, aligned to brane / mentions / heading-aware retrieval on 2026-04-25).

**User-facing impact:** Replaces the current `CommandPalette` + `LoreAskPanel` with a single `⌘K`-opened glass modal — one surface that is a fast slash-command palette while typing and an agentic LLM that can directly act on the canvas on Enter. Local-first slash commands (`/search`, `/ask`, `/create`, `/goto`, `/recent`, `/action`, `/help`) keep instant interactions free of LLM cost. The LLM path is fully agentic via Anthropic native tool-use over the existing MCP schemas — it can answer questions, navigate, filter the canvas, run palette actions, and (after a confirm card) create entities and links. Citations are heading-anchored (`Title › Section › Subsection`) so click-to-source jumps to the cited paragraph, not just the document. After answering a "what's connected to X" question, the agent surfaces the existing `AltGraphCard` so the user immediately sees the explicit + implicit subgraph.

**Why now (alignment with networked-thought work shipped 2026-04-23 → 2026-04-25):**

- The brane partition (`branes` table + `spaces.brane_id`, migrations `0015`–`0016`) and `entity_mentions` (term + semantic, migration `0017`) are most useful when a user can ask natural-language questions across them. The AskBar is the surface that pulls brane-graph reasoning into everyday flow without a separate panel.
- Heading-aware retrieval (`item_embeddings.heading_path`, migration `0014`) added section paths to `LoreSource.matchedChunks[*]`. Today's `LoreAskPanel` does not surface this richer shape; the AskBar consumes it as first-class citation metadata.
- `mention_count` (term frequency for lexical rows; `mentionCountFromDistance` for semantic rows in [`src/lib/entity-mentions.ts:170–172`](../src/lib/entity-mentions.ts)) is the implicit-edge weight signal — the right primitive for an LLM answering "what's most strongly connected to X."

**Phase 5 themes this entry subsumes** (replaces the previous bullet list under Mid-term):

- **Auto-linking beyond in-note `[[` assist** — the agent's term-resolution path (`heartgarden_term_mentions` → `heartgarden_brane_vocabulary` → `heartgarden_search`) plus `/goto` typeahead with brane-vocabulary fallback covers the proper-noun resolution use case. The `BufferedContentEditable` `[[` popover is already deprecated; entity discovery happens through the AskBar and Alt-hover instead.
- **Lore consistency checker (LLM)** — exposed as both a slash command (`/action consistency`) and a first-class MCP tool (`heartgarden_consistency_check`) the agent can call mid-conversation. Same underlying `/api/lore/consistency/check` route, three new entry points.
- **Deeper graph/timeline integration with persisted `item_links` and UUID stability** — the brane graph + `entity_mentions` work shipped the persistence and stability layers; the AskBar makes them legible to the user via `heartgarden_brane_graph` (one-call subgraph with explicit + implicit edges and weights) and `ui_open_alt_graph` (visual surface for the result).

**Approach (v1 cut):**

- **New `POST /api/ask` SSE route.** Anthropic native tool-use loop (max 5 turns), non-streaming tool turns + streamed final answer, `pending_confirmation` for writes, reuses `lore-query-rate-limit`. System prompt declares the active `braneId` and forbids cross-brane work explicitly.
- **Brane-strict, two-layer tool dispatcher.** Every `tool_use` is pre-flighted against `activeBraneId` via `gmMayReadBraneIdAsync` in [`src/lib/heartgarden-api-boot-context.ts`](../src/lib/heartgarden-api-boot-context.ts); cross-brane calls return `tool_result.is_error` without dispatch. The existing API-layer enforcement still runs (defense in depth).
- **New `src/components/ui/AskBar.tsx`.** Centered glass modal, ARIA combobox, two-accent mode system (orange = command, purple = ask), confirm-write card. Reliability rules to defuse past `backdrop-filter` bugs: single glass layer, `isolation: isolate` (no `transform: translateZ(0)`), `@supports` fallback to `--sem-surface-glass-fallback`, `[data-hg-askbar-surface="matte"]` runtime escape (`?askbar=matte`), and a P1 Storybook canary that reproduces "glass inside a transformed ancestor."
- **8 new MCP tools** (each wraps an existing route — benefits external MCP clients like Claude Desktop / Cursor MCP host immediately):
  - **Palette / lore parity (5):** `heartgarden_suggest`, `heartgarden_consistency_check`, `heartgarden_space_reindex`, `heartgarden_recent_edits`, `heartgarden_schema` (static enums for valid `item_type` / `entity_type` / `link_type`).
  - **Networked-thought parity (3):** `heartgarden_brane_graph` (one-call explicit + implicit subgraph from a seed item), `heartgarden_brane_vocabulary` (term inventory for a brane), `heartgarden_term_mentions` (resolves a term across the brane, ranked by `mention_count` — distinct from per-item `heartgarden_entity_mentions`).
- **6 client-only "virtual tools"** the agent emits as `pending_action` results: `ui_navigate` (with optional `headingAnchor`), `ui_open_panel`, `ui_run_palette_action`, `ui_filter_canvas`, `ui_open_alt_graph` (`{ term }` → opens the existing `AltGraphCard` for the active brane), `ui_confirm_write` (the single injection / runaway-loop gate for writes).
- **Documentation pass.** `docs/API.md` MCP inventory + cross-refs, `AGENTS.md` MCP paragraph (mark `heartgarden_title_mentions` deprecated, note `traverse_links.implicit_mode` and `lore_query.response_mode`), `docs/MCP_CANVAS_MODEL.md` write-tools table, `docs/MCP_BINDING_CONTRACT.md` schema cross-ref, new `docs/MCP_TOOL_REFERENCE.md` consolidated table, plus reconciliation of the stale "brane graph is uncapped" line in `docs/API.md` §Branes & mentions (route is now neighborhood-first and capped — see header at [`app/api/graph/brane/route.ts:17–38`](../app/api/graph/brane/route.ts)).
- **Glass-modal reliability invariant** added to `AGENTS.md` so future glass surfaces don't rediscover the bug (lists ancestor-chain triggers: `transform`, `filter`, `perspective`, `contain: paint`, nested `backdrop-filter`, `will-change: transform`, plus the `getVigilPortalRoot` escape pattern).

**Risk callouts:**

- **Glass UI** has bitten us before (canvas surfaces failed to render). Mitigations are explicit and tested; if a user reports issues, `?askbar=matte` separates "glass bug" from "other bug" in ten seconds.
- **Prompt injection.** `ui_confirm_write` is the single gate; no write tool can land without explicit user click on the confirm card. The agent loop pre-flights every brane / tier check before dispatch.
- **Brane invariant.** Strict active-brane-only in v1. Cross-brane queries are explicitly out of scope and require their own design pass with consent UX. A GM in the GM brane cannot reach the Player or Demo brane through the AskBar.
- **MCP surface expansion.** 8 new tools — `heartgarden_space_reindex` joins the write tool list and respects read-only mode; the 3 networked-thought tools are read-only but GM-only via `gmMayReadBraneIdAsync` against their `braneId` arg.
- **Replaces existing surfaces.** `CommandPalette` and `LoreAskPanel` get deleted after migration (their stories too). `/api/lore/query` is preserved as an agent tool and external MCP target.

**Out of scope (deferred to v1.1+):**

- Multi-turn conversation history (each Enter is a fresh session in v1).
- `@mentions` inside the bar for attaching specific entities/spaces as context.
- Saved prompts / pinned commands.
- Section-level edits by the agent (`heartgarden_patch_item` still rewrites whole bodies).
- Cross-brane queries.
- `/graph <term>` slash command (`ui_open_alt_graph` virtual tool ships in v1; the slash entry waits on usage signal).

**Cross-cuts (key files the plan touches or consumes):**

- **New:** `src/components/ui/AskBar.tsx`, `src/lib/ask/agent-tools.ts`, `app/api/ask/route.ts`, `src/lib/ask/system-prompt.ts`, `src/lib/ask/command-registry.ts`, `docs/MCP_TOOL_REFERENCE.md`.
- **Modify:** [`src/components/foundation/ArchitecturalCanvasApp.tsx`](../src/components/foundation/ArchitecturalCanvasApp.tsx) (swap modal mounts), [`src/lib/mcp/heartgarden-mcp-server.ts`](../src/lib/mcp/heartgarden-mcp-server.ts) (8 new tool registrations + `HEARTGARDEN_MCP_WRITE_TOOL_NAMES`), [`app/globals.css`](../app/globals.css) (new `[data-hg-askbar="*"]` block).
- **Delete (after migration):** [`src/components/ui/CommandPalette.tsx`](../src/components/ui/CommandPalette.tsx), [`src/components/ui/LoreAskPanel.tsx`](../src/components/ui/LoreAskPanel.tsx), their stories, the ask-lore palette action wiring.
- **Consumes (no changes needed):** branes (`src/lib/spaces.ts`, `gmMayReadBraneIdAsync`); mentions (`src/lib/entity-mentions.ts`, [`app/api/mentions/route.ts`](../app/api/mentions/route.ts), `app/api/items/[itemId]/mentions/route.ts`); brane graph ([`app/api/graph/brane/route.ts`](../app/api/graph/brane/route.ts)); brane vocabulary (`app/api/branes/[braneId]/vocabulary/route.ts`); heading-aware retrieval ([`src/lib/lore-engine.ts:185–189`](../src/lib/lore-engine.ts) already emits `headingPath`); `/api/lore/query` (`response_mode` already supports `text` / `grounded_json`).

<!-- backlog-score v1 | impact=8 | fit=9 | risk=6 | cost=L | composite_raw=3.7 | composite_mood=3.7 | mood=agents-pick | scored=2026-04-25T18:56Z | model=claude-opus-4-7 | category=feature | code_refs=heartgarden/src/components/ui/CommandPalette.tsx,heartgarden/src/components/ui/LoreAskPanel.tsx,heartgarden/src/components/foundation/ArchitecturalCanvasApp.tsx,heartgarden/src/lib/mcp/heartgarden-mcp-server.ts,heartgarden/app/api/lore/query/route.ts,heartgarden/app/api/graph/brane/route.ts,heartgarden/app/api/mentions/route.ts,heartgarden/src/lib/lore-engine.ts,heartgarden/src/lib/entity-mentions.ts,heartgarden/app/globals.css -->

---

## Later — Phases 6–8 + `VISUAL_REVAMP_PLAN`

<!-- migrated-from: docs/BUILD_PLAN.md §Later on 2026-04-23 -->

- Visual/typography polish, performance (culling, bundle), PWA/offline strategy, prefs — per legacy master plan + **`FOLLOW_UP.md`**.

---

## Cross-cutting code health (pointer)

<!-- migrated-from: docs/BUILD_PLAN.md §Code health backlog on 2026-04-23 -->

**Dated audit:** [`CODE_HEALTH_AUDIT_2026-04-21.md`](./CODE_HEALTH_AUDIT_2026-04-21.md) — 45 prioritized items (CRITICAL → LOW) and a three-week attack order. Strike items there as they land; do **not** duplicate individual items into this file to avoid drift.

**Status as of 2026-04-23:** audit is fully closed — CRITICAL/HIGH tranche 2026-04-21, remaining items closed same day (batch 2 A–D + remaining tranche). Pointer retained for the next dated audit.

### React 19 strict hooks ESLint warnings (pnpm migration)

**Dated audit:** [`ESLINT_WARNINGS_2026-04-25.md`](./ESLINT_WARNINGS_2026-04-25.md) — 106 warnings across 13 files, 0 errors. Introduced by the npm → pnpm migration on `clean-up-dev` which resolved newer `eslint-plugin-react-hooks` with stricter React 19 rules. Currently downgraded to warnings in `eslint.config.mjs` so builds pass.

**Breakdown:** 42× `set-state-in-effect`, 50× `refs`, 2× `purity`, 1× `immutability`, 3× stale `eslint-disable` directives (auto-fixable). ~78% of warnings are in `ArchitecturalCanvasApp.tsx`.

**Fix approach (5 incremental batches):**
1. Auto-fix 3 stale `eslint-disable` directives (`pnpm run lint --fix`).
2. Extract `useLatest()` hook → fix 39 ref-sync warnings in `ArchitecturalCanvasApp` + 3 in `VigilFlowRevealOverlay`.
3. Fix 15 `set-state-in-effect` warnings in smaller components (initializer functions, `useSyncExternalStore`).
4. Fix 32 `set-state-in-effect` warnings in `ArchitecturalCanvasApp` (case-by-case review).
5. Fix 3 purity/immutability warnings.

**Risk:** low — all are warnings, not errors. No runtime behavior change. Goal is to eventually promote these rules back to errors once all sites are clean.

---

## Review-sourced backlog

*(Filed here by `/review-heavy` or `/review-light` when a `NET_NEW` finding exceeds ~5 files or introduces a new subsystem — see `.cursor/skills/review-common/CLOSURE_POLICY.md` → "NET_NEW Feature Overflow → Backlog". Empty sections are fine.)*

### From `REVIEW_2026-04-25_1835.md` (scaling audit overflow)

- **Bootstrap envelope + per-space lazy items** — *CRITICAL · NET_NEW · L*
  - User-facing impact: TTFB and first-paint stall on workspaces with thousands of items because the bootstrap response carries every full row.
  - Evidence: `heartgarden/app/api/bootstrap/route.ts:76`, `heartgarden/src/lib/spaces.ts:323` (`listItemsForSpaceSubtree`).
  - Approach:
    - Define a small bootstrap envelope (spaces tree + active-space camera + minimal item index: id/title/type/spaceId/zIndex/x/y).
    - Add `GET /api/spaces/[id]/items?fields=minimal|canvas|content&cursor=…` for full bodies, fetched on `enterSpace` or scroll-into-view.
    - Update the canvas hydration pipeline (`useArchitecturalCanvasState`/`apiBootstrap`) to merge envelope first, then lazy-fetch per space.
    - Mirror the ETag pattern from `/api/graph/brane`.
  - Risk: high — touches sync core, requires versioned client/server contract.
  - Source: `docs/REVIEW_2026-04-25_1835.md` (CRITICAL #1).

- **Canvas connection-layout per-frame O(edges) → per-space index + visible-set** — *CRITICAL · RISKY · L*
  - User-facing impact: Branes with thousands of connections drop frames during pan/zoom and can freeze the page even when most edges are off-screen.
  - Evidence: `heartgarden/src/components/foundation/ArchitecturalCanvasApp.tsx:4898` (per-RAF iteration over `graphSnap.connections`).
  - Approach:
    - Maintain `Map<spaceId, Connection[]>` updated incrementally on graph mutations.
    - Compute "currently visible connections" once per pan/zoom (not per frame); apply rope simulation only to the visible + recently-dirtied set.
    - Replace `querySelectorAll('path[data-connection-id]')` with a stable id→element map kept in a ref.
  - Risk: high — canvas core; needs broad regression coverage (camera/pan/zoom, follow, presence).
  - Source: `docs/REVIEW_2026-04-25_1835.md` (CRITICAL #2).

- **Vault-index dedupe queue + `content_hash` chunk skip + chunk upsert** — *CRITICAL · RISKY · M/L*
  - User-facing impact: Lore imports and bulk renames silently spawn N OpenAI / Anthropic jobs per item with no dedupe; the `content_hash` skip path exists in schema but is dead code; embeddings are deleted-and-reinserted on every reindex.
  - Evidence: `heartgarden/src/lib/schedule-vault-index-after.ts:19`, `heartgarden/src/lib/item-vault-index.ts:206`, `heartgarden/src/db/schema.ts:241` (`content_hash`).
  - Approach:
    - Add a process-local dedupe map keyed on `itemId` with a 2–5s coalesce window.
    - Bounded worker pool (e.g. 4 concurrent reindexes) draining a FIFO; persist queued ids in a small `vault_index_jobs` table or extend `lore_import_jobs`.
    - Add `UNIQUE(item_id, chunk_index)` and convert reindex from delete-and-reinsert to upsert: only re-embed chunks whose `content_hash` changed; delete chunks with stale `chunk_index`.
  - Risk: high — touches AI cost path, embedding correctness, and (if persisted) a new migration.
  - Source: `docs/REVIEW_2026-04-25_1835.md` (CRITICAL #3 + H7 + H13).

- **Item-links revision: write-time counter (kill correlated EXISTS scan)** — *HIGH · RISKY · M*
  - User-facing impact: Every `/changes` poll re-scans `item_links` and `entity_mentions` with correlated EXISTS subqueries; sustained DB CPU at scale.
  - Evidence: `heartgarden/src/lib/item-links-space-revision.ts:33`.
  - Approach:
    - Add `space_link_revisions(space_id PK, revision bigint, max_updated_at timestamptz)`.
    - Bump `revision` from every write path that touches `item_links` or `entity_mentions` for that space.
    - Replace the read-time aggregate with `SELECT revision … WHERE space_id = $1`. Keep the 1s in-process cache as a thundering-herd damper.
  - Risk: high — touches every write path that creates/updates/deletes links or mentions.
  - Source: `docs/REVIEW_2026-04-25_1835.md` (HIGH #1).

- **TipTap editor lazy-mount on canvas (focus-only)** — *HIGH · RISKY · L*
  - User-facing impact: 200+ note cards in a space mount 200+ ProseMirror editors at once; memory/CPU explode.
  - Evidence: `heartgarden/src/components/foundation/ArchitecturalNodeCard.tsx:149`, `heartgarden/src/components/editing/HeartgardenDocEditor.tsx:107`.
  - Approach:
    - Render a static read-only HTML/text shell from cached `bodyHtml` for non-focused cards.
    - Mount `HeartgardenDocEditor` only on focus / hover-to-edit / explicit double-click.
    - Reuse the body HTML projection produced by the graph state.
  - Risk: high — canvas core editing flow, undo/redo and presence interactions need verification.
  - Source: `docs/REVIEW_2026-04-25_1835.md` (HIGH #15).

- **Lore-import durable queue + per-brane mutex + sweeper** — *HIGH · RISKY · M*
  - User-facing impact: Deploying mid-import leaves jobs stuck `processing` until a user happens to poll; concurrent imports against the same brane race each other.
  - Evidence: `heartgarden/src/lib/lore-import-job-after.ts:5`, `heartgarden/app/api/lore/import/jobs/[jobId]/route.ts:281`.
  - Approach:
    - Periodic sweeper (Vercel cron) reclaims stale `processing` jobs without requiring polling.
    - Add `claimed_by` / advisory lock keyed on `space_id` (or brane) so two jobs serialize.
    - Long-term: factor the queue into a durable backend (Redis BullMQ, `pg-boss`, or a dedicated worker).
  - Risk: high — durable queue is new infra; advisory-lock semantics need careful test coverage.
  - Source: `docs/REVIEW_2026-04-25_1835.md` (HIGH #11).

- **Spaces-tree + parent-chain process cache (revision-token keyed)** — *HIGH · RISKY · M*
  - User-facing impact: Every `/changes` poll and every realtime publish reads the entire `spaces` table to compute subtrees / ancestors; at hundreds of folders this dominates DB load.
  - Evidence: `heartgarden/app/api/spaces/[spaceId]/changes/route.ts:128`, `heartgarden/src/lib/heartgarden-realtime-invalidation.ts:11`.
  - Approach:
    - Cache subtree-membership and parent-chain maps keyed on a small `spaces` revision token bumped on any space mutation.
    - Reuse across polls and across the realtime invalidation publisher.
    - Combine with the new `spaces(parent_space_id)` index (see DB-migrations question batch).
  - Risk: high — realtime/sync core; bust-on-write logic must cover create/rename/reparent/delete.
  - Source: `docs/REVIEW_2026-04-25_1835.md` (HIGH #14, #16).

- **Tombstone log endpoint replaces `includeItemIds=1` full-subtree id scan** — *MEDIUM · RISKY · M*
  - User-facing impact: Every minute, every active tab sends a `SELECT id FROM items WHERE space_id IN (subtree)` for hard-delete reconciliation; payload + DB load grow with corpus and tab count.
  - Evidence: `heartgarden/app/api/spaces/[spaceId]/changes/route.ts:152`, `heartgarden/src/hooks/use-heartgarden-space-change-sync.ts:34`.
  - Approach:
    - New `item_tombstones(item_id, space_id, deleted_at)` indexed on `(space_id, deleted_at)`.
    - `GET /api/spaces/[id]/tombstones?since=<cursor>` returns incremental deletions.
    - Drop `includeItemIds=1` from the official client; keep behind a flag for a transition window.
  - Risk: medium-high — sync-core contract; touches client merge loop.
  - Source: `docs/REVIEW_2026-04-25_1835.md` (MEDIUM #1).

- **Promote hot `entity_meta` keys to typed columns + partial indexes** — *MEDIUM · RISKY · M*
  - User-facing impact: Subtree listing and search filters fall back to row-by-row JSON evaluation; queries that "should be" fast take seconds at 10k+ items.
  - Evidence: `heartgarden/src/lib/spaces.ts:333`, `heartgarden/src/lib/spaces.ts:414`.
  - Approach:
    - Add `is_archived boolean`, `lore_historical boolean`, `canonical_entity_kind text` columns; backfill from `entity_meta` and write through.
    - Partial indexes for `is_archived = false` and `lore_historical = false`.
    - Keep `entity_meta` as the durable source of truth.
  - Risk: medium-high — schema migration + write-path changes across PATCH paths.
  - Source: `docs/REVIEW_2026-04-25_1835.md` (MEDIUM #3).

- **Undo/redo: structural-share or diff history** — *MEDIUM · RISKY · M*
  - User-facing impact: Long sessions on populated branes accumulate ~96 full graph clones; GC pauses and tab kills under memory pressure.
  - Evidence: `heartgarden/src/components/foundation/architectural-undo.ts:3`.
  - Approach:
    - Switch to operation-based history (record diffs / inverse-ops) or structurally-shared snapshots (immer-style).
    - Cap by estimated memory size, not snapshot count.
  - Risk: medium-high — undo/redo correctness across all graph operations needs broad test coverage.
  - Source: `docs/REVIEW_2026-04-25_1835.md` (MEDIUM #7).

- **Per-tenant cost observability + budget caps for OpenAI / Anthropic** — *MEDIUM · NET_NEW · M*
  - User-facing impact: Runaway imports or bad prompts can cost real dollars before anyone notices; no per-tenant meter, no alert path.
  - Evidence: `heartgarden/src/lib/anthropic-client.ts:157`, `heartgarden/src/lib/embedding-provider.ts:23`.
  - Approach:
    - Emit structured per-call metrics (`tenant/space/item/chunks/tokens/retries/estimated_cost_usd`) at full sample rate.
    - Persist to `ai_call_log` table (or external metrics backend) with daily aggregation.
    - Per-space and per-day budget caps that 503 with explicit "budget exceeded" reason.
  - Risk: medium — new system; deferring billing-style accounting until observability ships.
  - Source: `docs/REVIEW_2026-04-25_1835.md` (MEDIUM #9).

- **Sliding-window rate limits on Redis / Upstash KV (replace in-memory)** — *HIGH · NET_NEW · S/M*
  - User-facing impact: Each Vercel instance has its own quota map, so attackers / runaway agents can multiply effective throughput by warm-instance count; no global Anthropic spend ceiling.
  - Evidence: `heartgarden/src/lib/search-rate-limit.ts:1`, `heartgarden/src/lib/lore-query-rate-limit.ts:1`.
  - Approach:
    - Move both limiters to Vercel KV / Upstash Redis with sliding-window counters keyed on actor (boot session + IP).
    - Reuse the existing Upstash client from `heartgarden-realtime-publisher.ts`.
    - Add an absolute per-tenant per-day budget for `lore/query`.
  - Risk: medium — new dependency, must coexist with current in-memory limiter as fallback.
  - Source: `docs/REVIEW_2026-04-25_1835.md` (HIGH #19).
  - Cross-link: existing entry `Near-term — hardening & parity` #1 covers the same ground; treat as the canonical implementation entry.

- **Synthetic perf-brane fixture + Playwright frame-budget gate** — *LOW · NET_NEW · S/M*
  - User-facing impact: Performance regressions land unnoticed because demo / Storybook fixtures are tiny.
  - Evidence: `heartgarden/seed/demo-brane.json:14`.
  - Approach:
    - Generator script producing 1k items / 5k connections / 50 spaces in `seed/perf-brane.json`.
    - Playwright smoke test gates first-paint and pan/zoom frame budgets against the perf brane.
  - Risk: low — additive, no production code change.
  - Source: `docs/REVIEW_2026-04-25_1835.md` (LOW #2).

---

## Archive (DNF / out-of-scope)

*(Items moved here instead of deleted when explicitly declined or superseded. Keep strike-through + DNF comment per [`SCORING.md`](../../.cursor/skills/backlog/SCORING.md).)*

*No entries yet.*

---

*Living document — edit when scoping, scoring, or retiring backlog items. Keep it as the single destination so future `/backlog` runs have one file to reason about.*
