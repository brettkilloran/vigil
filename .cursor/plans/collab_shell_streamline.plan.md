---
name: ""
overview: ""
todos: []
isProject: false
---

# Collab shell: improvements, simplification, and streamlining

**Context:** Heartgarden’s multiplayer MVP (local camera, delta poll, optional `baseUpdatedAt` / 409, presence) is largely implemented. This plan is **what to do next** to reduce complexity, cost, and drift—without reopening product decisions locked in [players_multiplayer_hardening.plan.md](./players_multiplayer_hardening.plan.md).

**Non-goals (for this plan):** CRDT/OT live typing, shared server camera, full auth redesign.

---

## Phase A — Extract and thin `ArchitecturalCanvasApp`

`Important: Before beginning, check all recent code for multiplayer work that may conflict or change our approach. Ensure the plan is not stale or liekly to create problems.`

**Problem:** Collab logic (delta poll, presence, graph hydration) is buried in a very large component, which slows changes and hides dependencies.

**Work:**

1. Extract **custom hooks** (names indicative only):
  - `useHeartgardenSpaceChangeSync` — `syncCursorRef`, `fetchSpaceChanges`, `mergeRemoteItemPatches`, interval, visibility guard, `focusDirty` skip rule.
  - `useHeartgardenPresenceHeartbeat` — `getOrCreatePresenceClientId`, POST interval, peer poll interval, `setPresencePeerCount`.
2. Keep **public behavior identical** (8s poll, 25s heartbeat, 12s presence poll unless you unify in Phase C).
3. Optionally extract **small pure helpers** next to hooks if they need unit tests without mounting the shell.

**Done when:** `ArchitecturalCanvasApp.tsx` no longer owns timer wiring for sync/presence; hooks are testable or at least readable in isolation.

---

## Phase B — Shared API guard for space-scoped routes

**Problem:** `GET/POST …/changes` and `GET/POST …/presence` duplicate the same sequence: `tryGetDb` → boot context → visitor blocked → `assertSpaceExists` → mask 404 for visitor → `visitorMayAccessSpaceId` → GM `gmMayAccessSpaceId`.

**Work:**

1. Add something like `assertHeartgardenSpaceRouteAccess({ db, bootCtx, spaceId })` in `vigil/src/lib/` (or next to `heartgarden-api-boot-context.ts`) that returns either `{ space }` or a `Response` to return early.
2. Refactor **changes** and **presence** routes to use it; extend to other space routes only where it stays a clear win (avoid a mega-abstraction).

**Done when:** Space route handlers read as “authorize → business logic,” with one place to update policy.

---

## Phase C — Align and centralize collab timing constants

**Problem:** TTL, heartbeat, and poll intervals are split across client, server, and docs; easy to desync.

**Work:**

1. Single module (e.g. `vigil/src/lib/heartgarden-collab-constants.ts`) exporting:
  - `PRESENCE_TTL_MS` (or server-only re-export if you must avoid client import of server file),
  - client heartbeat / poll intervals documented as **must stay under TTL with margin**.
2. **Server:** `presence/route.ts` imports TTL from that shared constant (or a `*-server.ts` sibling if tree-shaking / boundary matters).
3. **Docs:** One line in `PLAYER_LAYER.md` tying poll/heartbeat/TTL to the shared numbers.

**Done when:** Changing TTL requires one edit + docs note, not a scavenger hunt.

---

## Phase D — Presence: rate limit + stale row cleanup

**Problem:** Heartbeats are unbounded writes; `space_presence` rows are never deleted, only filtered on read.

**Work:**

1. **Rate limit** `POST …/presence` (per IP and/or per `clientId`), same spirit as `heartgarden-boot-rate-limit.ts` / vault limits—in-memory, documented as best-effort on serverless.
2. **Cleanup:** On `GET` or `POST` (or both), periodically `DELETE FROM space_presence WHERE updated_at < :cutoff` for the **current `spaceId`** (or global batch with low frequency) so the table does not grow forever.

**Done when:** Abuse is damped and table size stays bounded under normal use.

---

## Phase E — Delta API: reduce full-scan cost (prioritized options)

**Problem:** Every poll returns **all** `itemIds` in the subtree plus changed rows—expensive for large canvases.

**Pick one track first (recommend E1 → E2):**


| Track  | Idea                                                                                                                                                                              | Tradeoff                                                                         |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **E1** | Return `**itemIds` only when needed** — e.g. include a query flag `includeItemIds=1` default off for clients that already have a snapshot; first poll after navigation sends `1`. | Client must handle “no list” vs “full list”; needs one-time reconciliation rule. |
| **E2** | **Separate “deletions since”** (tombstones or `deleted_item_ids`) so steady-state polls skip full id enumeration.                                                                 | Requires delete path to record tombstones or a changelog table.                  |
| **E3** | **Cursor/version** without full id set: server maintains monotonic revision per space/subtree.                                                                                    | More schema/API design; best long-term.                                          |


**Done when:** Steady-state poll is O(changes) not O(all items), with a clear migration path for existing clients.

---

## Phase F — Faster `mergeRemoteItemPatches`

**Problem:** Implementation scans **all** spaces for every deletion and every changed item.

**Work:**

1. Restrict work to `**subtreeSpaceIds`** plus any space that currently holds entities being updated/removed (or build a one-pass `entityId → spaceId` map from `prev` for entities in subtree).
2. Add Vitest cases: **move between spaces**, **many spaces / few changes** (performance regression guard can be a simple “operations count” or timing threshold in test if you add a test double).

**Done when:** Merge cost scales with affected entities/spaces, not global space count.

---

## Phase G — UX and observability (small, high leverage)

**Work:**

1. **Page Visibility:** Pause delta (and optionally presence) **intervals** when `document.visibilityState === "hidden"`; resume on `visibilitychange` — fewer no-op ticks and requests.
2. **Failed polls:** If `fetchSpaceChanges` fails repeatedly, surface a **non-blocking** status (reuse neon sync bus or status bar) so “offline / sync stuck” is visible.
3. **Tests:** Extend Vitest merge tests for **dirty focus skip** behavior if not already covered; keep Playwright stub tests as smoke only.

**Done when:** Background tabs are quieter and users get a hint when sync is failing.

---

## Suggested order

1. **A** (extract hooks) — unlocks safer changes for F and G.
2. **B** + **C** — low risk, immediate clarity.
3. **D** — operational hygiene before scaling traffic.
4. **F** — cheap win if large GM workspaces exist.
5. **E** — biggest API/shape decision; do after guardrails are clean.
6. **G** — can parallelize with D or F.

---

## Verification

- `npm run check` from `vigil/` after refactors.
- Two-browser smoke: delta still merges; presence still counts peers; no camera regression (per existing plan).
- If E changes response shape: update `docs/API.md` and any client types in `architectural-neon-api.ts` / `canvas-types.ts`.

