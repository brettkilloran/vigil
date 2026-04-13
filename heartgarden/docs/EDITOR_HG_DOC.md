# Heartgarden document editor (`hgDoc`)

## Baseline (replaced stack)

- **Previous:** `BufferedContentEditable` + `document.execCommand`, checklist DOM, block drag handles.
- **Current:** Tiptap (ProseMirror) with `content_json.format === "hgDoc"` and a `doc` JSON field (TipTap `JSONContent`).

## Visual parity targets

- Focus body: `ArchitecturalCanvasApp.module.css` — `.focusBody` (e.g. 18px, line-height 1.7, `--sem-text-focus-body`).
- Card body: same typographic rhythm via `HeartgardenDocEditor.module.css` + shared semantic tokens in `app/globals.css`.

## Persistence

- `buildContentJsonForContentEntity` writes `{ format: "hgDoc", doc, hgArch }`.
- `content_text` / search / vault index use plain text derived from `doc` (see `hg-doc/serialize.ts`).
- `entity.bodyHtml` is a **derived** HTML snapshot from `doc` for link extraction and legacy HTML consumers (e.g. `extractVigilIdsFromHtml`).

## Clean break

- Rows without `format: "hgDoc"` load as an **empty** document (demo/onboarding content is recreated manually).
- Default/task note bodies are **hgDoc-only** at render time: `ArchitecturalNodeBody` always mounts
  `HeartgardenDocEditor` for `documentVariant: "hgDoc"` even when `bodyDoc` is missing (falls back to
  an empty hgDoc shape, never legacy HTML editor fallback).

## Blocks (v1)

- Paragraph (body), headings 1–3, blockquote (callout), bullet/ordered lists (single level), horizontal rule, image, task list / task item (checkbox rows).

## Surfaces

- **hgDoc (TipTap):** default, task, and **code** note bodies (canvas + focus); media **gallery** captions; lore character/location **focus** hybrid (`LoreHybridFocusEditor` + `focus-lore-notes` surface).
- **HTML / legacy:** lore character + location **canvas** plates (full hybrid shell) still use `BufferedContentEditable` until the shell is split into isolated React regions — see `docs/EDITOR_SURFACE_CUTOVER.md`.

## AI / import pending text (`hgAiPending`)

Provenance for **Heartgarden AI or import output that is not yet reviewed** is modeled as a TipTap **mark** named `hgAiPending` on text ranges. It serializes to HTML as `<span data-hg-ai-pending="true" class="hgAiPending">…</span>` so snapshots and non-TipTap surfaces can still render the same tint.

- **Styling:** Semantic tokens in `app/globals.css` (e.g. `--sem-text-ai-pending`, border/underline mix). Scoped editor rules in `HeartgardenDocEditor.module.css` and canvas/focus body rules in `ArchitecturalCanvasApp.module.css` where hgDoc appears inside `.nodeBody` / `.focusBody`.
- **Clearing:** Edits inside a pending span shrink/clear the mark (ProseMirror plugin + `appendTransaction` in `hg-doc/hg-ai-pending-mark.ts`); programmatic strip uses `remove-hg-ai-pending-range.ts` with history metadata so undo/redo stay coherent.
- **Margin “Bind”:** `HeartgardenDocEditor` can render `HgAiPendingEditorGutter.tsx` — one control per collected pending range (`collect-hg-ai-pending-ranges.ts`) to clear that span without selecting text.
- **Strip helpers:** `strip-hg-ai-pending.ts` removes marks from hgDoc JSON and unwraps matching spans in HTML — used when the user **Accepts** review from the card chrome (`ArchitecturalNodeCard` / `acceptAiReviewForEntity` in `ArchitecturalCanvasApp.tsx`).
- **Item-level flag:** `items.entity_meta.aiReview` (`"pending"` | cleared) drives the **Unreviewed** tag when the body still contains pending markup; see `docs/FEATURES.md` and import paths in `lore-import-apply.ts` / `lore-import-commit.ts`.
- **Surface coverage:** **Bind** and full TipTap behavior apply wherever **`HeartgardenDocEditor`** is mounted. Lore **canvas** HTML plates still inherit **global** pending appearance for wrapped spans but do not use the hgDoc gutter until those bodies are hgDoc.

## Deprecation posture

- `BufferedContentEditable` is **legacy-only** for lore hybrid **canvas** cards and plain-text folder titles.
- Toolbar command routing prefers hgDoc editor registry and must not fall back to `document.execCommand`
  while the active target is inside `[data-hg-doc-editor]`.
- Behavioral acceptance tracking lives in `docs/EDITOR_ACCEPTANCE_MATRIX.md`.
