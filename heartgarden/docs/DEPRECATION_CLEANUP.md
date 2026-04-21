# Document Editor Deprecation Cleanup

## Goal

Retire legacy rich-text editing paths after the hgDoc cutover, without reintroducing behavior drift between focus and canvas.

This document is the cleanup playbook for post-cutover deletion and hardening work.

## Execution Status (current)

- Phase A (guardrails): complete
- Phase B (legacy path isolation): complete (`runHgDocFormat` / `runLegacyFormat` split in `ArchitecturalCanvasApp.tsx`)
- Phase C (dead-code deletion): partial — `runLegacyFormat` / **`normalizeChecklistMarkup`** remain for **non-hgDoc** and merge/focus HTML paths (see `ArchitecturalCanvasApp` call sites); further deletion requires the **Deletion Gates** § checklist below.
- Phase D (hard enforcement): complete for automated gates (`verify:editor-cutover`, acceptance matrix automation, text-editing E2E)

## Scope

- In scope:
  - Default/task note editing command path and rendering path.
  - Legacy command fallback (`document.execCommand`) usage for prose note surfaces.
  - Legacy editor usage guardrails in app code, docs, and tests.
- Out of scope (for now):
  - Lore hybrid surfaces.
  - Code theme body editor.
  - Media gallery notes.
  - Folder title inline editor.

## Current State (Cutover Baseline)

- Default/task note bodies are rendered through `HeartgardenDocEditor` (`hgDoc`).
- Toolbar command routing prefers hgDoc command handling.
- Legacy fallback is prevented when target is inside `[data-hg-doc-editor]`.
- `BufferedContentEditable` remains for explicitly non-hgDoc surfaces.

## Cleanup Phases

### Phase A - Guardrails (must keep)

1. Keep code comments that mark `BufferedContentEditable` as legacy-only.
2. Keep docs updated:
  - `docs/EDITOR_HG_DOC.md`
  - this file (`docs/DEPRECATION_CLEANUP.md`)
3. Keep test assertions that confirm:
  - default/task surfaces are hgDoc-backed,
  - toolbar actions operate through hgDoc for those surfaces.

### Phase B - Legacy Path Isolation

1. Split formatting execution into explicit paths:
  - `runHgDocFormat(...)`
  - `runLegacyFormat(...)`
2. Ensure routing is structural, not best-effort:
  - if target is hgDoc surface, never call legacy format path.
3. Collapse shared helpers to avoid accidental mixed-mode calls.

### Phase C - Dead Code Deletion

Delete only after launch gates pass:

1. Remove note-body legacy checklist insertion logic that is unreachable for hgDoc note bodies.
2. Remove legacy-only toolbar command translation branches not used by any non-hgDoc surface.
3. Remove CSS selectors/utilities that only style removed legacy note-body blocks.

### Phase D - Hard Enforcement

1. Add CI grep/checks that fail if default/task note bodies are wired to `BufferedContentEditable`.
2. Add regression checks that fail if default/task saves as non-hgDoc format.
3. Add tests that fail on command fallback to `execCommand` for hgDoc targets.

## Deletion Gates (Required)

Do not delete compatibility code unless all are true:

1. E2E coverage passes for:
  - checkbox/checklist behavior,
  - quote/callout behavior,
  - focus + canvas command parity.
2. Persistence parity is verified:
  - `content_json.format` is `hgDoc` for default/task,
  - derived `content_text`/search/index remain correct.
3. No production regressions observed for one stable release window.

## Ownership + Touchpoints

- Core shell + command routing:
  - `src/components/foundation/ArchitecturalCanvasApp.tsx`
- hgDoc editor + command adapter:
  - `src/components/editing/HeartgardenDocEditor.tsx`
  - `src/lib/hg-doc/editor-registry.ts`
  - `src/lib/hg-doc/tiptap-format.ts`
- Legacy editor (restricted usage):
  - `src/components/editing/BufferedContentEditable.tsx`
- Persistence bridge:
  - `src/components/foundation/architectural-db-bridge.ts`

## Validation Checklist

- `text-editing` E2E suite passes.
- smoke E2E suite passes.
- hgDoc serialization tests pass.
- no new lint errors in touched files.
- docs reflect current runtime behavior.
- `docs/EDITOR_ACCEPTANCE_MATRIX.md` statuses are updated and launch-gate rows are green/signed-off.