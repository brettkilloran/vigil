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

Matches **legacy** Phase 5 themes and **`FOLLOW_UP.md`** LLM items (see archive master plan for original wording):

- Markdown bulk import + entity extraction pipeline.
- Auto-linking beyond in-note **`[[` assist** (popover in `BufferedContentEditable`) — e.g. batch suggest + review UX for imports.
- Deeper graph/timeline integration with persisted `item_links` and UUID stability everywhere.
- Lore consistency checker (LLM).

---

## Later — Phases 6–8 + `VISUAL_REVAMP_PLAN`

<!-- migrated-from: docs/BUILD_PLAN.md §Later on 2026-04-23 -->

- Visual/typography polish, performance (culling, bundle), PWA/offline strategy, prefs — per legacy master plan + **`FOLLOW_UP.md`**.

---

## Cross-cutting code health (pointer)

<!-- migrated-from: docs/BUILD_PLAN.md §Code health backlog on 2026-04-23 -->

**Dated audit:** [`CODE_HEALTH_AUDIT_2026-04-21.md`](./CODE_HEALTH_AUDIT_2026-04-21.md) — 45 prioritized items (CRITICAL → LOW) and a three-week attack order. Strike items there as they land; do **not** duplicate individual items into this file to avoid drift.

**Status as of 2026-04-23:** audit is fully closed — CRITICAL/HIGH tranche 2026-04-21, remaining items closed same day (batch 2 A–D + remaining tranche). Pointer retained for the next dated audit.

---

## Review-sourced backlog

*(Filed here by `/review-heavy` or `/review-light` when a `NET_NEW` finding exceeds ~5 files or introduces a new subsystem — see `.cursor/skills/review-common/CLOSURE_POLICY.md` → "NET_NEW Feature Overflow → Backlog". Empty sections are fine.)*

*No entries yet.*

---

## Archive (DNF / out-of-scope)

*(Items moved here instead of deleted when explicitly declined or superseded. Keep strike-through + DNF comment per [`SCORING.md`](../../.cursor/skills/backlog/SCORING.md).)*

*No entries yet.*

---

*Living document — edit when scoping, scoring, or retiring backlog items. Keep it as the single destination so future `/backlog` runs have one file to reason about.*
