# Cursor plans index (heartgarden)

Plans here are **optional engineering notes** (YAML todos, narratives). They are **not** the backlog of record.

| Authority | Path |
|-----------|------|
| **Repo-wide open backlog (SOT)** | [`heartgarden/docs/BACKLOG.md`](../heartgarden/docs/BACKLOG.md) |
| **Architecture snapshot + shipped tranches history** | [`heartgarden/docs/BUILD_PLAN.md`](../heartgarden/docs/BUILD_PLAN.md) |
| **Lore vertical pointer** | [`heartgarden/docs/LORE_ENGINE_ROADMAP.md`](../heartgarden/docs/LORE_ENGINE_ROADMAP.md) |

When a plan’s work lands or is cancelled, add **`Status:`** at the top of that `.plan.md` **or** move its row to **Completed / parked** below so agents do not treat stale notes as current behavior.

---

## Active (still drives or may drive work)

| Plan | Notes |
|------|--------|
| [`lore_entity_node_lab.plan.md`](./lore_entity_node_lab.plan.md) | Lore entity lab; YAML shows **pending** optional UI follow-ups. |
| [`location_lore_data_model_and_focus.plan.md`](./location_lore_data_model_and_focus.plan.md) | Location **persistence/focus** (field contract, notes in focus)—not the visual card-type lab; see `lore_entity_node_lab.plan.md` for plaque/postcard/survey UI. **Pending:** collab smoke, optional lab parity, extensions. |
| [`location_lore_variants_and_skins.plan.md`](./location_lore_variants_and_skins.plan.md) | Location **inventive skins / metaphors** (blueprint, deed, polaroid, etc.) constrained to the field contract; prototype picks + lab/canvas parity. **Pending:** product picks + implementation. |
| [`players_multiplayer_hardening.plan.md`](./players_multiplayer_hardening.plan.md) | **Living** — camera/localStorage, presence, sync (verify against code before treating as unfinished). |
| [`data_pipeline_import_hardening.plan.md`](./data_pipeline_import_hardening.plan.md) | **DATA_PIPELINE_AUDIT** tranche: import conformance + canonical-kind mapping, registry cohesion, three-track smoke, multiplayer expectations vs Figma-like (see audit §10–§12). |

---

## Reference (audited periodically; not auto-backlog)

These are retained for context. **Confirm open work in [`heartgarden/docs/BACKLOG.md`](../heartgarden/docs/BACKLOG.md)** (SOT), not only here.

| Plan | Topic |
|------|--------|
| [`collab_shell_streamline.plan.md`](./collab_shell_streamline.plan.md) | Collab shell |
| [`dock_create_snappy.plan.md`](./dock_create_snappy.plan.md) | Dock / create flow |
| [`mobile_fixes_desktop-safe.plan.md`](./mobile_fixes_desktop-safe.plan.md) | Mobile fixes |

---

## Completed / parked (history only)

| Plan | Notes |
|------|--------|
| [`canvas_navigation_ux.plan.md`](./canvas_navigation_ux.plan.md) | **DNF 2026-04-23** — 7/8 todos match shipped tranches in `heartgarden/docs/BUILD_PLAN.md` (minimap + fit, wiki link assist, vault index status UI, space-nav guard, `CanvasViewportToast`). Retained for historical context. |
| [`multiplayer_presence_ui.plan.md`](./multiplayer_presence_ui.plan.md) | **DNF 2026-04-23** — all checklist items covered by `heartgarden/docs/BUILD_PLAN.md` §Completed tranches "Soft presence + follow view" row. Residual multiplayer work lives in `players_multiplayer_hardening.plan.md`. |

---

## Superseded

| Replaced by | Notes |
|-------------|--------|
| — | *Add when a plan is explicitly replaced by another doc or PR.* |
