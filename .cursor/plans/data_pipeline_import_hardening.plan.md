---
name: Data pipeline & lore import hardening
Status: "Docs landed (2026-04-11): LORE_IMPORT_KIND_MAPPING.md, PLAYER_LAYER multiplayer section, BUILD_PLAN pointer, CANVAS_LORE_NODE_PATTERNS checklist, AGENTS three-track smoke, HEARTGARDEN_MASTER_PLAN index. **TypeScript wiring (`lore-object-registry.ts`, `lore-import-apply`, tests) requires Agent mode** — see plan body §Implementation handoff."
overview: "Execute the DATA_PIPELINE_AUDIT (§9–§10, §12) tranche: import conformance + canonical-kind mapping, single object-type registry story, three-track smoke discipline, and explicit multiplayer expectations vs Figma-like goals."
todos:
  - id: import-mapping-matrix
    content: "Document and implement a single mapping table canonicalEntityKind → DB entity_type + loreCard/hgArch + seed path (or explicit generic note); align lore-import-plan-build/apply/commit + architectural-db-bridge with tests"
    status: pending
  - id: import-conformance-tests
    content: "Add automated tests: plan JSON taxonomy validity; apply layout stability; create-vs-merge determinism fixtures; merge-under-concurrent-edit scenarios (mock or dual-client simulation where feasible)"
    status: pending
  - id: registry-module
    content: "Introduce or consolidate one registry module (kinds + UI render predicate + search/MCP notes) per audit §6; add 'add kind' checklist test that fails if a column is unwired"
    status: pending
  - id: smoke-playbook-ci
    content: "Wire DATA_PIPELINE §4 three-track smoke as recurring gate: document in AGENTS or CI checklist; optional minimal scripted steps (non-LLM) for demo/player smoke"
    status: pending
  - id: localstorage-namespacing
    content: "Spike optional heartgarden-space-camera (and related) keys namespaced by boot tier/session id; measure risk vs migration; ship behind flag or doc-only decision"
    status: pending
  - id: multiplayer-expectations-doc
    content: "Short BUILD_PLAN or PLAYER_LAYER addendum: 'Figma-like' = out of scope for polling model; link audit §12; keep E2/E3 delta backlog separate from UX promises"
    status: pending
isProject: false
---

# Data pipeline & lore import hardening

**Authority:** Execution backlog remains **`vigil/docs/BUILD_PLAN.md`**. This file is the **focused tranche** for [`vigil/docs/DATA_PIPELINE_AUDIT_2026-04-11.md`](../../vigil/docs/DATA_PIPELINE_AUDIT_2026-04-11.md) §6 (registry), §8–§9 (gaps), §10 (recommended tranche), §12 (multiplayer brief), and §4 (three-track smoke).

**Non-goals here:** Replacing polling with CRDT/OT, or promising Figma-class live collaboration without an explicit architecture program.

---

## Problem statement

1. **Lore import** is graded **partial**: taxonomy (`CANONICAL_ENTITY_KINDS`) is richer than specialized lore card UI (mostly character/faction/location); mapping to `entity_type` + `hgArch` / templates can drift; merge/apply against **live** graphs can race with sync.
2. **Registry cohesion** is **partial** (audit §6): UI affordances, import output, search blob, and MCP are not enforced by one testable registry.
3. **Multi-mode** (GM Neon / demo / player) works but **bleed risk** remains (shared `localStorage` keys, same shell); **three-track smoke** is documented but not a single enforced gate.
4. **Multiplayer** is **intentionally** polling + server truth + 409 — audit §12 labels “Figma-like” as **strategic gap**, not a bug list.

---

## Track A — Import mapping & conformance

**Goal:** Every import-facing kind has an explicit, tested outcome: persisted row shape, canvas shell, and merge behavior.

| Step | Action | Primary code / docs |
|------|--------|----------------------|
| A1 | **Mapping matrix** (table in repo, e.g. `docs/LORE_IMPORT_KIND_MAPPING.md` or section in `CANVAS_LORE_NODE_PATTERNS.md`): `npc` → note vs character shell, `quest`/`item`/`lore`/`other` → rules | `lore-import-canonical-kinds.ts`, `lore-import-plan-build.ts`, `lore-import-apply.ts`, `architectural-db-bridge.ts`, `lore-node-seed-html.ts` |
| A2 | **Conformance tests** — plan output validates against Zod/schema; apply does not stack cards at identical coords when plan specifies offsets; create vs merge idempotent on replay | `lore-import-apply.ts`, `lore-import-plan-llm.test.ts` (extend), new `lore-import-conformance.test.ts` |
| A3 | **Live-edit stress** — at minimum: unit/integration tests for merge proposal apply when `bodyHtml`/`bodyDoc` changed since plan; document manual two-tab scenario from audit §4 | `lore-import-apply.ts`, `architectural-db-bridge.ts` |

**Exit criteria:** No unmapped canonical kind defaults to “silent plain note” without a row in the matrix; CI runs A2 tests.

---

## Track B — Registry cohesion (single story)

**Goal:** One **source of truth** for “kind exists” across UI, import, search, and (where relevant) MCP — validated by tests.

| Step | Action | Notes |
|------|--------|------|
| B1 | **Module** — e.g. `src/lib/lore-object-registry.ts` (or extend `lore-import-canonical-kinds.ts`) exporting: canonical id, `entity_type` string, whether `loreCard` applies, `shouldRender*` predicate pointer or label | Keep small; avoid duplicating full UI |
| B2 | **Test** — `registry-wiring.test.ts`: for each exported kind, assert mapping row exists + `buildSearchBlob` / item type path does not throw; optional snapshot of search-relevant fields | Catches “added kind, forgot search” |
| B3 | **Contributor checklist** in `docs/CANVAS_LORE_NODE_PATTERNS.md` or `CODEMAP.md` — “adding a kind” bullets | Links to B1 |

**Exit criteria:** Adding a new kind without updating the registry fails CI (or a single explicit test file).

---

## Track C — Multi-mode discipline & storage

**Goal:** Operators and CI repeatedly validate GM / demo / player paths; optional reduce profile-level confusion from shared keys.

| Step | Action |
|------|--------|
| C1 | **Smoke gate** — Add `npm run smoke:three-track` **or** document in `AGENTS.md` / GitHub Action manual job that §4 playbook is run before release (checkbox template) |
| C2 | **localStorage namespacing** — Design: suffix `heartgarden-space-camera-v1` with `sessionId` or `bootTier` (audit §5 matrix). Prototype in `heartgarden-space-camera.ts`; migration: read old key once, write new, or dual-read for one version |
| C3 | **Risk note** — If namespacing ships, update `PLAYER_LAYER.md` / `API.md` client storage notes |

**Exit criteria:** C1 documented and at least one automated **non-LLM** step (e.g. demo boot returns `demo: true`) in CI optional; C2 either implemented with migration or explicitly **deferred** with ADR-style paragraph in audit or `BUILD_PLAN`.

---

## Track D — Multiplayer expectations (documentation, not rewrite)

**Goal:** Product and engineering share one story: **what shipped** vs **what would require a new program**.

| Step | Action |
|------|--------|
| D1 | **Short subsection** in `BUILD_PLAN.md` (Near-term) or `PLAYER_LAYER.md`: link **audit §12**; list **Option A** (harden polling, E2/E3) as the near-term track; label “Figma-like” as **out of scope** until OT/CRDT decision |
| D2 | **Separate** GitHub/epic label suggestion: `collab-bug` vs `collab-roadmap` so tactical fixes do not imply pixel-perfect multiplayer |

**Exit criteria:** No marketing copy implies real-time shared editing parity with Figma-class tools without pointing at audit §12.

---

## Dependencies & ordering

1. **A1 / B1** can proceed in parallel (mapping doc informs registry module).
2. **A2** depends on stable A1 decisions for assertions.
3. **C1** is independent (docs/CI).
4. **C2** is optional and may follow C1.
5. **D1** is quick documentation and should land early to set expectations.

---

## Implementation handoff (code not applied in Plan mode)

The following must be added in **Agent** (or normal edit) mode:

1. **Create** [`vigil/src/lib/lore-object-registry.ts`](../../vigil/src/lib/lore-object-registry.ts) — exports `persistedEntityTypeFromCanonical`, `loreShellKindFromCanonical`, `isLoreCardPersistedEntityType`, `ALL_CANONICAL_KINDS` (see matrix in [`LORE_IMPORT_KIND_MAPPING.md`](../../vigil/docs/LORE_IMPORT_KIND_MAPPING.md)).
2. **Wire** [`vigil/src/lib/lore-import-apply.ts`](../../vigil/src/lib/lore-import-apply.ts) — replace `entityType: note.canonicalEntityKind` and `buildSearchBlob` `entityType` with `persistedEntityTypeFromCanonical(note.canonicalEntityKind)`.
3. **Tests** — `lore-object-registry.test.ts`, `lore-import-registry-wiring.test.ts` (iterate `ALL_CANONICAL_KINDS` + `buildSearchBlob`), optional `lore-import-conformance.test.ts` for `planLoreImportCardLayout` non-overlap.
4. **Optional** — `npm run smoke:three-track` script echoing §4 checklist; **localStorage** namespacing remains deferred unless product approves migration.

Remove the **Status** handoff line above once code ships.

## Related documents

- [`vigil/docs/DATA_PIPELINE_AUDIT_2026-04-11.md`](../../vigil/docs/DATA_PIPELINE_AUDIT_2026-04-11.md)
- [`vigil/docs/BUILD_PLAN.md`](../../vigil/docs/BUILD_PLAN.md) (E2/E3, near-term hardening)
- [`vigil/docs/PLAYER_LAYER.md`](../../vigil/docs/PLAYER_LAYER.md)
- [`vigil/docs/CANVAS_LORE_NODE_PATTERNS.md`](../../vigil/docs/CANVAS_LORE_NODE_PATTERNS.md)
