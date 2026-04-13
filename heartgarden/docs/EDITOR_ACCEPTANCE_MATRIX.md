# Editor Acceptance Matrix (hgDoc)

This is the source-of-truth behavior matrix for default/task note editing after hgDoc cutover.

Use this to prevent regressions and avoid ad-hoc one-off fixes.

## Coverage Legend

- `Automated`: covered in Playwright/Vitest.
- `Manual`: must be verified by human QA.
- `Planned`: not yet covered.

## A. Core Entry + Focus


| ID  | Behavior                                                              | Scope  | Coverage  | Evidence                                                             |
| --- | --------------------------------------------------------------------- | ------ | --------- | -------------------------------------------------------------------- |
| A1  | Canvas note body receives caret and keeps typing session anchored     | Canvas | Automated | `e2e/text-editing.spec.ts` (`keeps caret anchored...`)               |
| A2  | Focus-mode note body receives caret and keeps typing session anchored | Focus  | Automated | `e2e/text-editing.spec.ts` (`focus mode body preserves...`)          |
| A3  | Body draft persists after blur/commit path                            | Canvas | Automated | `e2e/text-editing.spec.ts` (`node body keeps typed text after blur`) |


## B. Toolbar Command Parity


| ID  | Behavior                                                           | Scope          | Coverage  | Evidence                                                                         |
| --- | ------------------------------------------------------------------ | -------------- | --------- | -------------------------------------------------------------------------------- |
| B1  | Toolbar `Checklist` converts current paragraph to checklist row    | Canvas + Focus | Automated | `e2e/text-editing.spec.ts` checklist semantics test                              |
| B2  | Enter in non-empty checklist row creates next checklist row        | Canvas + Focus | Automated | `e2e/text-editing.spec.ts` checklist semantics test                              |
| B3  | Enter in empty checklist row exits checklist row to body paragraph | Canvas + Focus | Automated | `e2e/text-editing.spec.ts` (`checklist empty-row Enter exits...`)                |
| B4  | Backspace at start of empty checklist row exits checklist row      | Canvas + Focus | Automated | `e2e/text-editing.spec.ts` (`checklist empty-row Backspace exits...`)            |
| B5  | Toolbar `Quote` toggles blockquote/callout on current block        | Canvas + Focus | Automated | `e2e/text-editing.spec.ts` (`quote toolbar toggles...` canvas + focus)           |
| B6  | Heading picker (`Body/H1/H2/H3`) applies selected block style only | Canvas + Focus | Automated | `e2e/text-editing.spec.ts` (`heading picker applies H2 then body paragraph`)     |
| B7  | Bulleted/Numbered toggles are reversible and preserve caret intent | Canvas + Focus | Automated | `e2e/text-editing.spec.ts` (`bulleted and numbered list toggles are reversible`) |


## C. Visual + Layout Fidelity


| ID  | Behavior                                                               | Scope          | Coverage | Evidence                                                                       |
| --- | ---------------------------------------------------------------------- | -------------- | -------- | ------------------------------------------------------------------------------ |
| C1  | Checklist rows render checkbox inline with text baseline/top alignment | Canvas + Focus | Manual   | Screenshot QA + CSS in `HeartgardenDocEditor.module.css`                       |
| C2  | Checked checklist row shows completed visual treatment                 | Canvas + Focus | Manual   | CSS rule `li[data-checked="true"]`                                             |
| C3  | Drag handle placement is aligned and non-overlapping                   | Focus          | Manual   | `HeartgardenDocEditor.module.css` drag handle rules                            |
| C4  | Dropcursor and selected-node affordances are visible and consistent    | Focus          | Manual   | `HeartgardenDocEditor.module.css` `.hgDropcursor`, `.ProseMirror-selectednode` |


## D. Persistence + Schema Guarantees


| ID  | Behavior                                                          | Scope              | Coverage  | Evidence                                                    |
| --- | ----------------------------------------------------------------- | ------------------ | --------- | ----------------------------------------------------------- |
| D1  | Default/task save as `content_json.format = "hgDoc"`              | Persistence        | Automated | `architectural-db-bridge.hgdoc.test.ts`                     |
| D2  | `content_text` derives from hgDoc serializer                      | Persistence/Search | Automated | `hg-doc-serialize.test.ts`                                  |
| D3  | HTML snapshot is derived from hgDoc (not source of truth)         | Persistence        | Manual    | `docs/EDITOR_HG_DOC.md` + code path review                  |
| D4  | Default/task render path does not fall back to legacy HTML editor | UI                 | Automated | `ArchitecturalNodeBody` hgDoc-only branch + TODO test guard |


## E. Legacy Isolation Gates


| ID  | Behavior                                                                  | Scope           | Coverage  | Evidence                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------- | --------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | hgDoc toolbar commands never execute legacy `execCommand` on hgDoc target | Command routing | Automated | Structural split (`runHgDocFormat` / `runLegacyFormat`) in `ArchitecturalCanvasApp.tsx` + `npm run verify:editor-cutover` + checklist anti-legacy assertion in `e2e/text-editing.spec.ts` |
| E2  | `BufferedContentEditable` remains restricted to non-hgDoc surfaces        | Architecture    | Manual    | `BufferedContentEditable` deprecation comment + usage review                                                                                                                              |
| E3  | New default/task surfaces cannot be wired to legacy editor                | CI policy       | Automated | `npm run verify:editor-cutover` (`scripts/verify-editor-cutover.mjs`)                                                                                                                     |


## Required Launch Gate

Do not call editor hardening complete unless all `Planned` rows in sections B, D, and E are upgraded to `Automated` or explicitly accepted as `Manual` with sign-off.