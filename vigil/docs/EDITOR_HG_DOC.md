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

- **hgDoc:** default + task note bodies (canvas + focus), excluding code theme, lore hybrid shells, and media card chrome.
- **HTML:** gallery captions, lore hybrid documents, code-theme body (unchanged).

## Deprecation posture

- `BufferedContentEditable` is now legacy-only for non-hgDoc surfaces.
- Toolbar command routing prefers hgDoc editor registry and must not fall back to `document.execCommand`
  while the active target is inside `[data-hg-doc-editor]`.
- Behavioral acceptance tracking lives in `docs/EDITOR_ACCEPTANCE_MATRIX.md`.
