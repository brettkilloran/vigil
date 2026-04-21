# Character focus HTML vs hgArch bindings (round-trip)

## Current surfaces

- **Focus overlay / credential HTML** (e.g. affiliation, nationality blocks) is merged via **`src/lib/lore-character-focus-document-html.ts`** — narrative, display-first prose in the DOM.
- **Structured bindings** live under **`content_json.hgArch`** (roster, `loreThreadAnchors`, planned multi-value slots) — source of truth for **canvas chrome**, **thread evaluation**, and **binding projection** in vault text.

## Single-writer rule (v1 engineering)

1. **Authoritative for “this card employs / lives at / is on roster”:** **hgArch** + validated **`item_links`** that mirror approved patterns (`canvas-thread-link-eval.ts`).
2. **Authoritative for readable narrative on the focus surface:** HTML in the focus document **unless** the field is explicitly documented as **projected from hgArch** in the shell variant.
3. **When they disagree:** treat as **two editable surfaces** until product defines automatic sync. Lore Q&A and search see **both** vault text (prose + `buildHgArchBindingSummaryText`) and retrieved neighbors; consistency review can flag mismatches (`structuredBindingTargets` in **`lore-consistency-check.ts`**).

## Future sync (product)

Optional milestones: (a) one-way **project** hgArch → focus labels for empty HTML fields; (b) **write-back** from focus only into explicit hgArch slots with user confirmation; (c) deprecate duplicate HTML fields when shells fully own those slots.
