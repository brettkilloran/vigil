# Plan: Character focus + data model (end-to-end)

This plan aligns **UI**, **editor behavior**, and **persistence** so character nodes stay correct across canvas, focus, Neon sync, search, and future tooling. It assumes the product direction you confirmed: **one global focus shell** (document editor interaction model), **canvas may diverge visually**, **notes belong in focus** (hidden on canvas only for height), and **no reliance on split-draft hacks** unless the stored model truly requires them.

---

## 1. Current data model (invariants to preserve)

| Layer | What is stored | Notes |
|--------|----------------|--------|
| **Neon / items row** | `title`, `content_text` (plain), `content_json` | `content_json` is `format: "html"` + `html` + `hgArch` (theme, `loreCard`, tape, rotation). |
| **Graph entity** | `CanvasContentEntity.bodyHtml`, optional `entity.loreCard` | `loreCard` comes from bootstrap `hgArch`, `entity_type`, or **`bodyHtmlImpliesLoreCharacterV11(bodyHtml)`** (`charSkShellV11` / portrait root markers). |
| **Save path** | `buildContentJsonForContentEntity` → PATCH item | Single HTML blob; no separate “notes” column. |
| **Undo / restore** | Same `bodyHtml` in snapshots; `buildContentItemRestorePayload` | Character is unchanged: one body string. |

**Conclusion:** Any “fix” must keep **one canonical `bodyHtml`** per item. UI may **render** it differently in canvas vs focus, but **commits** must round-trip the same structure the server and detectors expect, unless you run an explicit **migration** (see §6).

---

## 2. Problems to fix (beyond CSS)

1. **Structural mismatch** — v11 HTML was designed for a **small credential card** (nested `contenteditable`s, placeholders, markers). Using it as the **only** host for a **full document** focus works but fights nested-field vs notes semantics (slash/insert scope, caret, accessibility).
2. **Detection coupling** — `shouldRenderLoreCharacterCredentialCanvasNode` and `bodyHtmlImpliesLoreCharacterV11` depend on **class names / attributes** in saved HTML. Refactors that rename or strip nodes risk **losing `loreCard` inference** or breaking canvas routing.
3. **Placeholder / caret subsystems** — `lore-v9-placeholder`, `lore-v11-ph-caret`, display-name sync assume **specific DOM**. A React-only focus view must either **reuse** the same subsystems against compatible DOM or **re-implement** behavior with tests.
4. **Plain-text and search** — `contentText` / indexing uses **`htmlToPlainText(bodyHtml)`**. Noise from header/meta in HTML affects snippets; acceptable short-term, but worth a follow-up **chunking** strategy (notes-only region) if search quality matters.
5. **Remote sync / 409** — `applyServerCanvasItemToGraph` replaces from server row; focus must **close or reconcile** if `bodyHtml` changes underneath (existing pattern; verify character nodes don’t assume stale slice state — **already true** after single-editor simplification).

---

## 3. Target architecture (choose a track)

### Track A — **HTML-first (incremental, lower risk)**

Keep **one `bodyHtml`** with the current v11 template. Improve **focus** with:

- Stronger **focus-only CSS** (already: `.focusCharacterDocument`) + optional **DOM order** tweaks via seed for **clear visual “metadata block → notes”** without two editors.
- **Explicit stable hooks** in seed HTML: `data-hg-lore-region="identity" | "notes"` on wrappers for **targeted** slash/insert rules and future migrations (additive, backward compatible).
- **Tests** that parse sample `bodyHtml` and assert **detectors + `buildContentJson`** still produce the same `loreCard` / `entityType`.

**Pros:** No migration; sync unchanged. **Cons:** Still nested CE complexity.

### Track B — **React focus surface + serialize (medium risk)**

- **Canvas:** unchanged or lightly styled HTML from seed.
- **Focus:** Render **React components** (portrait, fields, rich notes) fed by **parsed** `bodyHtml` or by a **small JSON sidecar** in `hgArch` (e.g. `hgArch.loreCharacter: { displayName, … }`) with **HTML as fallback** for legacy rows.

Requires:

- **Parse / serialize** functions with **golden tests** (round-trip preserves markers detection needs).
- **Migration script** or lazy migration on save: old rows → new shape once.
- **Explicit `loreCard`** in `hgArch` so detection does not depend on fragile HTML substrings alone.

**Pros:** First-class focus UX; clearer separation of metadata vs long-form. **Cons:** Engineering cost; migration discipline.

### Track C — **New content schema (highest leverage, largest cost)**

Store character as **structured fields + notes HTML** in `content_json` (not only one big HTML string). **Major** API, import, MCP, and migration work — only if product commits to structured lore long-term.

**Recommendation:** Plan **Track A** immediately (hooks + tests + editor rules); **prototype Track B** behind a flag if focus UX still feels constrained after A.

---

## 4. Work breakdown (phased)

### Phase 1 — **Stabilize contracts (no user-visible drama)**

1. **Document invariants** in `docs/CANVAS_LORE_NODE_PATTERNS.md` (link here): single `bodyHtml`, `loreCard` inference rules, what must not be stripped.
2. **Add golden fixtures:** 2–3 real `bodyHtml` samples (empty, filled notes, legacy) → assert:
   - `bodyHtmlImpliesLoreCharacterV11` / `shouldRenderLoreCharacterCredentialCanvasNode`
   - `buildContentJsonForContentEntity` shape
   - `htmlToPlainText` does not throw
3. **Optional:** `data-hg-lore-region` on seed + non-breaking **migration** that only **inserts attributes** into existing HTML on next save (idempotent).

### Phase 2 — **Focus UX + editor behavior (Track A)**

1. **Header** — Keep aligned with global focus (readable meta, no ID-card copy).
2. **Single editor** — Maintain one `BufferedContentEditable`; refine **`isRichDocBodyFormattingTarget`** if regions are tagged (`data-hg-lore-region="notes"`).
3. **Canvas** — Keep notes hidden for height; document that **full** body still syncs.
4. **Accessibility** — Tab order through nested fields + notes; spot-check screen reader labels on portrait upload.

### Phase 3 — **Sync & edge cases**

1. **Focus open + incoming PATCH** — Confirm shell behavior when `bodyHtml` updates from server (reload, collab); no orphan state.
2. **Import / export** — If lore import touches character HTML, run fixtures through import pipeline or add a smoke test.
3. **Vault index** — Optional: document that character **notes** may need weighted chunks later; not blocking if plain index is acceptable.

### Phase 4 — **Track B spike (optional)**

1. Define **minimal** `hgArch.loreCharacter` or parse-only model.
2. Implement **parse → React focus UI → serialize** with **round-trip tests**.
3. Feature flag: `FOCUS_CHARACTER_REACT=1` in dev only until parity.

---

## 5. Success criteria

- **Data:** Save/load/bootstrap/restore produce **identical** `loreCard` + searchable row for unchanged content.
- **UX:** Focus feels like **the same document editor** as other notes; character-specific chrome is **stylistic**, not a second app.
- **Engineering:** Golden tests prevent regressions on HTML detectors and `content_json` shape.

---

## 6. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| HTML refactor breaks detection | Golden tests + prefer **additive** `data-*` + keep `bodyHtmlImplies…` fallbacks during transition |
| Nested CE bugs | Region tags + narrow automated test for caret/placeholder libs |
| Migration drift | Lazy migration on save + version field in `hgArch` if needed |

---

## 7. Out of scope (unless product expands scope)

- Replacing Neon row shape with a separate notes table.
- Real-time collaborative editing of the same field (current model is last-write-wins PATCH).

---

## 8. Ownership & order

1. Phase 1 tests + invariants (fast, protects everything after).
2. Phase 2 UI/editor (user-visible improvement).
3. Phase 3 sync/import/index verification.
4. Phase 4 only if Track A plateaus.

This sequence keeps the **data model honest** while allowing the **UI overhaul** to proceed without another cycle of fragile one-off fixes.
