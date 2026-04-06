# Multiplayer presence, cursors, and follow-view

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

- [ ] Schema migration + presence route (subtree GET, extended POST)
- [ ] Client sync + pointer debounce + peer state
- [ ] `enterSpace` camera override + follow flow + confirm when focus/stack open
- [ ] Canvas cursor overlay + status bar avatars
- [ ] Tests, docs, Storybook
