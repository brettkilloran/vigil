# Multiplayer presence, cursors, and follow-view

**Status: DNF (superseded — see `heartgarden/docs/BUILD_PLAN.md` §Completed tranches "Soft presence + follow view" row. Active residual multiplayer work lives in `.cursor/plans/players_multiplayer_hardening.plan.md`. Plan retained for historical context.)**

## Resolved decisions (pre-implementation)

1. **Presence scope:** Use **subtree as the default** for `GET /api/spaces/[spaceId]/presence` so peers who drill into child spaces still appear while you are in a parent. Rationale: the heartgarden app is the primary API consumer; document the shape change in `docs/API.md`. If a legacy `scope=local` escape hatch is trivial to add, it can remain for debugging — not required for MVP.

2. **Follow while focus/modal open:** **Confirm first** — e.g. “Close focus and jump to their view?” / equivalent for stack modal; only proceed on accept. If declined, do nothing.

---

## Summary (from planning)

- **Storage:** One row per `clientId` (avoid duplicate rows when switching spaces). Columns: `active_space_id`, `camera` jsonb, `pointer` jsonb optional, `updated_at`.
- **POST:** Extend body with `camera` and optional `pointer`; URL `spaceId` = active viewing space (validated vs boot access).
- **GET:** Subtree of `spaceId` + TTL prune + `except` self. Return peers with space + camera + pointer for avatars and cursors.
- **Client:** Richer poll/heartbeat in `ArchitecturalCanvasApp` + `architectural-neon-api.ts`; Figma-style cursors in world space inside canvas transform; emoji from hash of `clientId`; status bar avatar strip, click → confirm if needed → `enterSpace` with **camera override** after navigation.
- **Docs/tests:** `docs/API.md`, `PLAYER_LAYER.md`, E2E stubs, route tests, Storybook.

## Todos

- [ ] ~~Schema migration + presence route (subtree GET, extended POST)~~ <!-- dnf: reason=superseded evidence=heartgarden/docs/BUILD_PLAN.md:63 scored=2026-04-23T00:00Z -->
- [ ] ~~Client sync + pointer debounce + peer state~~ <!-- dnf: reason=superseded evidence=heartgarden/docs/BUILD_PLAN.md:63 scored=2026-04-23T00:00Z -->
- [ ] ~~`enterSpace` camera override + follow flow + confirm when focus/stack open~~ <!-- dnf: reason=superseded evidence=heartgarden/docs/BUILD_PLAN.md:63 scored=2026-04-23T00:00Z -->
- [ ] ~~Canvas cursor overlay + status bar avatars~~ <!-- dnf: reason=superseded evidence=heartgarden/docs/BUILD_PLAN.md:63 scored=2026-04-23T00:00Z -->
- [ ] ~~Tests, docs, Storybook~~ <!-- dnf: reason=superseded evidence=heartgarden/docs/BUILD_PLAN.md:63 scored=2026-04-23T00:00Z -->
