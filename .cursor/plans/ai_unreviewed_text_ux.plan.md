# Unreviewed AI / ingestion text — UX plan (revised)

## Overview

Distinguish **your** reviewed prose from **Heartgarden AI / ingestion** output that is still **pending review**, with minimal chrome. Work proceeds in **two phases**: a **visual/UX demo** first, then full product wiring **only after** approval or feedback.

## Requirements the plan must satisfy

### Intra-block edits

Pending styling must work **inside** a single paragraph or block, not only on whole blocks.

- **Implication:** Provenance is **inline** (e.g. TipTap **mark** on a text range, or equivalent `<span>` in HTML), not only `data-*` on `<p>` / block nodes.
- **Clearing behavior:** Editing **within** a pending span should be able to shrink or clear the pending range (e.g. character-by-character adoption, or split marks on edit) so “I fixed one word” does not require replacing the whole block.

### Entirely LLM-generated entries

Some items are **100%** model output (new import notes, or merged content that replaces an empty body).

- **Implication:** The same **inline** mechanism applies: the **entire** document body can be wrapped in one pending mark (or every top-level block), plus optional **item-level** affordance (header chip: “Unreviewed” / “AI-sourced”) so zoomed-out canvases still signal state without opening the card.

## Current code reality (brief)

- Import/merge today: [`vigil/src/lib/lore-import-commit.ts`](vigil/src/lib/lore-import-commit.ts), [`vigil/src/lib/lore-import-apply.ts`](vigil/src/lib/lore-import-apply.ts) — no inline provenance; merge flattens text.
- Editors: hgDoc via [`vigil/src/lib/hg-doc/extensions.ts`](vigil/src/lib/hg-doc/extensions.ts); lore/HTML via `BufferedContentEditable` — see [`vigil/src/components/foundation/ArchitecturalNodeCard.tsx`](vigil/src/components/foundation/ArchitecturalNodeCard.tsx).

## UX direction (for demo + final)

- **Token:** e.g. `--sem-text-ai-pending` (cool tint, not error/warning).
- **Non-color cue:** one subtle secondary signal (left rule or soft underline) for accessibility.
- **Approved text:** unchanged “classic” primary body color (`--sem-text-primary`).

---

## Phase 1 — Demo mock (ship first)

**Goal:** A **small, static or lightly interactive demo** that mocks pending-AI styling so you can **fully approve** look and feel before any import/persistence work.

**Scope (intentionally narrow):**

- **Mock content only** — no `lore-import-apply`, no DB, no merge logic.
- Show **both** scenarios side by side or in tabs:
  1. **Mixed intra-block:** one paragraph containing normal text + a **mid-sentence** pending span (proves inline).
  2. **Fully LLM body:** entire note content styled as pending (proves whole-entry).
  3. **Optional:** a read-only or fake “cursor in pending span” caption to illustrate intra-block edit intent (or a tiny non-production TipTap shell if quick).

**Suggested surface (pick one in implementation):**

- **Storybook** story under `vigil/` (aligns with [`vigil/AGENTS.md`](vigil/AGENTS.md) Storybook guardrails), or
- A **dev-only** route/component gated behind an existing dev pattern, if you prefer in-app preview.

**Deliverable:** Tokens + CSS classes applied to **mock** markup (and optionally a throwaway TipTap instance) so you can sign off on **color, weight, border, and density**.

**Phase 2 is blocked** until Phase 1 is approved or revised from feedback.

---

## Phase 2 — Full implementation (after Phase 1 approval)

Depends on feedback. Likely includes:

- TipTap `hgAiPending` **mark** (intra-block) + HTML round-trip; parallel HTML `span` path for `BufferedContentEditable`.
- Import/merge: structured content; item-level chip optional.
- Edit/accept rules: implicit clear on edit + optional “Accept all.”

Detailed file list and rollout order follow Phase 1 sign-off.

---

## Implementation todos

### Phase 1

- [ ] Add provisional CSS tokens (or local demo-only tokens) + prose styles for pending inline + full-body cases.
- [ ] Build Storybook story or dev demo with mocked mixed paragraph, full-AI note, and optional intra-block scenario copy.
- [ ] Review with you; capture feedback for Phase 2.

### Phase 2 (post-approval)

- [ ] Persist marks / HTML wrappers from import and merge; `entityMeta` chip if desired.
- [ ] Editor commands + tests; production tokens finalized in `globals.css`.
