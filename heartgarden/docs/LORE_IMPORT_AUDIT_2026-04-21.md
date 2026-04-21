# Lore import + sort/categorize/link audit

Date: 2026-04-21
Scope: `heartgarden/` — purpose alignment, lore import pipeline, and the sort/categorize/link surfaces that sit around it.
Companion docs: `[STRATEGY.md](./STRATEGY.md)`, `[FEATURES.md](./FEATURES.md)`, `[API.md](./API.md)`, `[CODEMAP.md](./CODEMAP.md)`, `[LORE_ENGINE_ROADMAP.md](./LORE_ENGINE_ROADMAP.md)`, `[DATA_PIPELINE_AUDIT_2026-04-11.md](./DATA_PIPELINE_AUDIT_2026-04-11.md)`, `[CODE_HEALTH_AUDIT_2026-04-21.md](./CODE_HEALTH_AUDIT_2026-04-21.md)`.

---

## 1. Purpose recap (what the app is trying to be)

Heartgarden is a **spatial knowledge canvas** with a **TTRPG/worldbuilding specialization** (`[STRATEGY.md](./STRATEGY.md)`):

- Items (notes, sticky, checklist, folder, webclip, image, lore shells) are the **server source of truth**, persisted in Neon via Drizzle.
- Spaces form a tree (`spaces.parent_space_id`), and every folder opens its own canvas space. Viewport/camera is browser-local, not server-authoritative.
- Users connect cards three ways: **canvas threads** (`item_links` rows), **structured bindings** (`content_json.hgArch` slots on lore cards), and **wiki mentions** (`[[Title]]` / `vigil:item:<uuid>` in prose).
- The **lore vertical** differentiates the product: import long-form prose, have an LLM split it into folders/notes/links, merge into existing cards, surface clarifications, and reindex into the vault so it shows up in hybrid search and lore Q&A.

The import and sort/categorize/link features are the same pipeline looked at from two ends: ingestion writes into the same data model that the canvas, search, and retrieval read from. Divergences between ingestion taxonomy and render/recall taxonomy are the #1 risk class, exactly as flagged in `[DATA_PIPELINE_AUDIT_2026-04-11.md](./DATA_PIPELINE_AUDIT_2026-04-11.md)` §9.

## 2. Pipeline map (end to end)

### 2.1 Lore import — "smart" async path

1. `/api/lore/import/parse` (`POST multipart`) → raw text. PDF via `pdf-parse`, `.docx` via `mammoth`, otherwise UTF‑8.
2. `/api/lore/import/jobs` (`POST`) creates a `lore_import_jobs` row and calls `scheduleLoreImportJobProcessing`, which uses Next `after()` to run `processLoreImportJob` on the request's tail. Client polls `/api/lore/import/jobs/[jobId]` every ~1s for ≤12 min.
3. `processLoreImportJob` → `buildLoreImportPlan` (`src/lib/lore-import-plan-build.ts`):
  - `chunkSourceText` splits by markdown headings, subdivides > ~24 KB.
  - Outline LLM (`runLoreImportOutlineLlm`, `OUTLINE_SYSTEM`) emits folders, notes (with `canonicalEntityKind`, `sourceChunkIds`, `summary`, `ingestionSignals`, `campaignEpoch`, `loreHistorical`), and links (`linkType` + `linkIntent`).
  - `fillNoteBodiesFromChunks` attaches chunk text to each note's `bodyText`.
  - For every note, `hybridRetrieveItems` finds existing vault candidates (GM scope, lexical + pgvector RRF).
  - Merge LLM (`runLoreImportMergeLlmBatched`, batches of 10) emits `mergeProposals` + `contradictions`.
  - `filterPlanLinksToSameCanvasSpace` drops any link whose endpoints live in different folders, warning-only.
  - Clarify LLM (`runLoreImportClarifyLlm`, `CLARIFY_SYSTEM`) emits required + optional questions, each with a `planPatchHint` op (`set_note_folder`, `set_link_type`, `remove_link`, `set_ingestion_signals`, `set_lore_historical`, `discard_merge_proposal`, etc.).
  - Plan validated against `loreImportPlanSchema`, persisted to job row, and review-queue rows (`import_review_items`) are written **after** validation (CRITICAL #3 fix from 2026-04-21 audit).
4. UI (`ArchitecturalCanvasApp.tsx`, `loreSmartReview` state) shows Structure / Questions / Merges / Contradictions tabs. User accepts merges, answers clarifications, optionally uploads source.
5. `/api/lore/import/apply` (`POST`) → `applyLoreImportPlan`:
  - Validates clarification answers, applies `planPatchHint` ops.
  - Re-runs same-folder link filter.
  - Topo-sorts folders, creates child spaces.
  - For accepted merges: appends new body wrapped in `<span data-hg-ai-pending>…</span>`, updates `entity_meta.aiReview = "pending"`.
  - For new notes: creates items with `entity_type` mapped via `persistedEntityTypeFromCanonical` (npc → `character`), layout via `planLoreImportCardLayout` (fixed 2-col grid).
  - Inserts `item_links`, normalizing `linkType` (`"pin"` → `"history"` for import), enriching `meta` with `linkIntent` and semantic hints.
  - Marks matching `import_review_items` as resolved.
  - Schedules vault reindex via `scheduleVaultIndexAfter`.
  - Wrapped in `db.transaction` (CRITICAL #4 fix).

### 2.2 Lore import — legacy synchronous path

`/api/lore/import/extract` (single Anthropic call) + `/api/lore/import/commit` (transactional insert of notes + links, no folders, no merges, no clarifications). Still wired as a fallback in the shell when Neon / smart path is unavailable, and it runs through the same vault reindex tail. See §5.7.

### 2.3 Sort (folders) and categorize (types/meta)

- Folders create a **child space** (`spaces.parent_space_id`) and set `items.space_id` of each child item to that child. The canvas navigates by space. This is the only structural sort.
- **Item type** (`items.item_type`): note/sticky/image/checklist/webclip/folder. Stable set, DB-enforced.
- **Entity type** (`items.entity_type`): free-text. `persistedEntityTypeFromCanonical` standardizes the lore-mapped set (`character`, `faction`, `location`, `quest`, `item`, `lore`, plus ad‑hoc strings like `"lore_source"` for the ingested source card).
- **Lore card shells** (`loreCard.kind`): only three specialized renderers — `character`, `faction`, `location`. Everything else falls back to a generic note UI.
- **Entity meta** (`items.entity_meta`, jsonb): `canonicalEntityKind`, `ingestionSignals` (salience, voice, importance, freeform tags), `campaignEpoch`, `loreHistorical`, `aiReview`, `importBatchId`, ad hoc keys.
- **Lore meta** (`items.lore_summary`, `items.lore_aliases`): search-visible summary + alias list maintained by vault reindex (`item-vault-index.ts`).

### 2.4 Link (relationships)

Three surfaces, intentionally:

1. `**item_links`** — DB rows (source_item_id, target_item_id, link_type, meta). Canonical `linkType` = `pin | bond | affiliation | contract | conflict | history` (`src/lib/lore-link-types.ts`, `connection-kind-colors.ts`). Legacy aliases are normalized. Cross-space links are rejected server-side (`validateLinkTargetsInSourceSpace`).
2. **Structured bindings** (`content_json.hgArch`) on lore cards — e.g., faction `factionRoster[]`, character `primaryFaction`, `primaryLocation`, `linkedCharacterItemIds`, location `linkedCharacters`, `loreThreadAnchors`. Governed by `bindings-catalog.ts` (`BindingSlotDefinition`, `mirrorCanvasConnection`, `cardinality`, `writtenBy`, `targetEntityTypes`).
3. **Wiki mentions in prose** — resolved at retrieval time (graph neighbor expansion for lore Q&A).

Promotion flow: `runSemanticThreadLinkEvaluation` (`canvas-thread-link-eval.ts`) watches user-drawn threads and, via `CANVAS_THREAD_SEMANTIC_RULES`, mirrors them into hgArch slots when endpoint shapes match (character↔faction → roster row + primaryFaction anchor; character↔location → primaryLocation + linkedCharacters; faction↔location; etc.).

### 2.5 Retrieval (why categorization matters later)

- `buildSearchBlob` concatenates title, body text, prose, `entity_type`, `entity_meta`, `lore_summary`, `lore_aliases` into FTS.
- Hybrid retrieval (`hybridRetrieveItems`) runs pgvector kNN against `item_embeddings` and fuses with FTS via RRF; OpenAI embeddings only when `OPENAI_API_KEY` is set (CRITICAL #6 fix).
- Lore Q&A (`/api/lore/query`) retrieves seed items, expands `item_links` neighbors one hop, and also resolves prose `vigil:item` mentions. hgArch bindings are used indirectly via the cards they sit on.

## 3. What's working

- **Separation of concerns.** Plan building, validation, review persistence, and apply are well-bounded files with tight types (Zod schemas in `lore-import-plan-types.ts`).
- **Atomicity.** Both commit paths use `db.transaction`. Plan validation precedes review-queue persistence. Vault reindex runs via `after()` and is idempotent.
- **GM‑only gating.** `enforceGmOnlyBootContext` is applied on `parse`, `extract`, `plan`, `jobs`, `jobs/[jobId]`, `apply`, `commit` (HIGH #22 fix). Player tier genuinely cannot reach these.
- **Link taxonomy discipline.** A small canonical set, aliases normalized on write, cross-space enforcement server-side, semantic eval promotes threads into structured bindings.
- **Review affordances.** `hgAiPending` spans + `aiReview: "pending"` tag give the GM an explicit "did I read this?" loop rather than silently trusting LLM output.
- **Same-folder link rule.** Simple, predictable, mirrors the one-canvas-per-folder mental model.

## 4. Mismatches (where taxonomy, rendering, or recall diverge)

### 4.1 `canonicalEntityKind` is richer than what the canvas can render

- Import emits seven kinds: `npc`, `location`, `faction`, `quest`, `item`, `lore`, `other`.
- Only three have dedicated `loreCard` shells: `character`, `faction`, `location`. `quest`, `item`, `lore`, `other` persist as a generic note with `entity_meta.canonicalEntityKind`, but the chrome doesn't show that classification, doesn't filter by it, and search weighting doesn't use it.
- Net effect: the LLM's taxonomy work is only half-visible. Echoes `[DATA_PIPELINE_AUDIT_2026-04-11.md](./DATA_PIPELINE_AUDIT_2026-04-11.md)` §6 and §9 (Critical #1).

### 4.2 `linkIntent: "binding_hint"` is recorded but never promoted

- Outline prompt explicitly distinguishes "canvas association" from "binding_hint" and tells the model to flag the latter so the GM can populate a real hgArch slot.
- On apply, the hint is stored in `item_links.meta.linkIntent` — and nothing else happens. No pre-populated `factionRoster` stub, no `primaryFaction` anchor, no canvas cue. The structured binding surface is silently underused on import.

### 4.3 Link type not validated against endpoint shapes

- `affiliation` / `contract` / `bond` / `conflict` have implicit shape expectations (char↔faction, char↔char, faction↔faction, etc.), documented in prompts and rank tables but not enforced.
- The apply path will write any canonical type between any two items in the same space. A hallucinated `affiliation` between two `lore` notes sticks and colors the graph wrong.

### 4.4 Cross-folder links are silently dropped

- `filterPlanLinksToSameCanvasSpace` deletes cross-folder links with only a `warnings[]` entry. No fallback (e.g., emit `[[Title]]` prose mention, add a link to the parent folder card, or raise a clarification).
- In a richly-folded source doc, the graph gets thinner exactly where it should get denser.

### 4.5 "lore_source" entity type is an unregistered ad‑hoc kind

- The imported original document becomes an item with `entity_type = "lore_source"`. It's not in `lore-object-registry.ts`, not in `CANONICAL_ENTITY_KINDS`, not in `connection-kind-colors.ts`. It leaks into search_blob and queries but no test or validator governs it. A concrete instance of the `[DATA_PIPELINE_AUDIT_2026-04-11.md](./DATA_PIPELINE_AUDIT_2026-04-11.md)` "registry governance gap".

### 4.6 Chunk→note assignment has a dangerous fallback

- `fillNoteBodiesFromChunks` dumps **all chunks not claimed by any note** into the **first note's body** as "extra" content. If the outline model misses any IDs, note #1 becomes a giant dump.
- No check against double-assignment either: if two notes both claim chunk 5, both get its text (duplicate prose).

### 4.7 Two import paths, one UI — Resolved

- Resolved by `e46eca7` (routes gated behind `HEARTGARDEN_IMPORT_LEGACY_ENABLED`) and the follow-up shell cleanup that deleted `loreImportDraft`, `commitLoreImport`, and the legacy modal block from `ArchitecturalCanvasApp.tsx`. The shell now opens the smart review for every successful import and surfaces a clear failure message otherwise — no second modal, no fallback path.

### 4.8 Entity-meta is unbounded

- `entity_meta` is `z.any()` jsonb. `canonicalEntityKind`, `ingestionSignals`, `campaignEpoch`, `loreHistorical`, `importBatchId`, `aiReview`, etc. have no discriminated-union schema server-side. Drift risk grows every time the LLM or UI invents a new key.

### 4.9 `canonicalEntityKind` is write-only at recall

- It ends up in `search_blob` (as part of jsonb dump) but drives no retrieval weighting, no search filter, no Lore Q&A prompt shaping. The taxonomy work is essentially reference-only after ingestion.

### 4.10 Layout placer ignores existing content

- `planLoreImportCardLayout` is a fixed 2-column grid at `layout.originX/Y`. No collision detection against existing cards in the target space, no viewport awareness. On a populated canvas, imports overlap existing cards.

## 5. Gaps (capabilities the pipeline advertises but doesn't complete)

### 5.1 No dry-run / preview

- Smart review shows structure/merges/clarifications, but there's no "what would the canvas look like" preview: no layout, no colored graph, no estimate of cards/links created. Users commit blind and undo is manual.

### 5.2 No undo / no "import batch" deletion

- `importBatchId` is set in entity_meta but no endpoint operates on it. Mistake recovery is "find and delete each item and its links by hand".

### 5.3 No progress/phase reporting

- `lore_import_jobs` has `status: queued|running|ready|failed` only. Client polls blind for up to 12 minutes. A phase field (`outline → merge → clarify → persisted`) plus counters would build trust and enable better UX.

### 5.4 No cancellation

- Queued/running jobs can't be aborted. Wrong file or wrong space means waiting or ignoring.

### 5.5 No cost visibility

- Outline call is one Anthropic request on potentially 500 KB of text + every chunk's metadata. Merge runs `ceil(notes/10)` more calls. Clarify once more. Plus one hybrid vault search per note. No pre-submit estimate, no post-run cost stamp, no cap/budget knob.

### 5.6 No determinism / no "re-plan with my clarifications"

- `client.messages.create` is called without a seed or temperature override. Re-running the same file produces a different folder/note layout. There's also no "apply my clarifications, re-plan" loop short of restarting the whole job.

### 5.7 Legacy commit path isn't a fallback, it's a parallel reality

- Legacy `/extract` → `/commit` skips folders, merges, clarifications, `aiReview`, `linkIntent`, and ingestion signals. Data written through it never carries the richer metadata the rest of the system expects. Worth either (a) deprecating visibly and removing from UI, or (b) upgrading to use the same review-queue + reindex semantics.

### 5.8 Cross-space merge candidates vs same-space link rule

- Merge candidate retrieval uses a GM-wide scope (`GM_LORE_IMPORT_SEARCH`). Links are then restricted to same-folder. That asymmetry means a campaign's import can propose merges into another campaign's card (allowed, since merge is text-only) but never link between them. Intentional or leak? See §7 Q4.

### 5.9 `import_review_items` lifecycle leakage

- Rows persist for each contradiction and required clarification. They are marked resolved on apply, but abandoned jobs leave them behind. No TTL, no cleanup worker.

### 5.10 `lore_import_jobs.sourceText` retention

- Full source text (≤500 KB) stays in the jobs table forever. No archive step, no retention. With active use this grows unbounded.

### 5.11 Provenance is thrown away

- `sourceChunkIds` live on the plan; once apply runs, the link from created item ↔ originating chunk text is gone (plan is persisted on the job row but nothing on the items indexes back into it). No "show me where in the source this card came from" affordance.

### 5.12 Empty import‑time binding population for lore shells

- `createLoreCardContentJson` on import creates characters/factions/locations but does not seed `factionRoster`, `loreThreadAnchors`, `linkedCharacterItemIds` from detected `binding_hint` links. `createNewNode` in the shell does seed default rosters — import does not. Cards feel empty even when the plan knew who belonged together.

### 5.13 Graph surfaces don't differentiate association vs binding_hint

- `linkIntent` is stored but not consumed by the graph filter, canvas rope styling, or lore retrieval weighting. Users can't tell a "should be structured" rope from a "just a connection" rope.

## 6. Optimization opportunities (prioritized)

### P0 — correctness + trust


| #   | Recommendation                                                                                                                                                                                      | Where                                                                                       | Why                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| O-1 | Validate `linkType` against endpoint shapes at apply; coerce mismatches to `history` with a recorded warning.                                                                                       | `lore-import-apply.ts`, a new `coerceLinkTypeByEndpoints` helper.                           | Prevents miscolored graph and false structured hints.      |
| O-2 | Replace the "extra chunks into first note" fallback with an explicit `unassigned_chunks` clarification category.                                                                                    | `lore-import-plan-build.ts`, new clarify option.                                            | Fixes the silent bloat bug (§4.6).                         |
| O-3 | Promote `linkIntent: "binding_hint"` links into structured `hgArch` stubs on apply (e.g., insert a `factionRoster` row with `aiReview: "pending"`, set `primaryFaction`/`primaryLocation` anchors). | `lore-import-apply.ts`, `lore-import-apply-bindings.ts` (new).                              | Closes §4.2 / §5.12 in one change, reuses the review flow. |
| O-4 | Add `importBatchId` lookup endpoint + "Undo this import" UI action.                                                                                                                                 | `app/api/lore/import/batches/[id]/route.ts`, shell button.                                  | Recovers from mistaken imports cheaply.                    |
| O-5 | Drop legacy `/extract` + `/commit` from the UI (keep endpoints for MCP parity) OR upgrade them to carry merges + `aiReview` + reindex metadata.                                                     | `ArchitecturalCanvasApp.tsx`, `app/api/lore/import/commit/route.ts`.                        | Removes the silent two-reality split (§5.7).               |
| O-6 | Enforce a typed schema on `items.entity_meta` (discriminated union) at write points that the importer touches.                                                                                      | `src/lib/entity-meta-schema.ts` (new), wired into `/apply`, `/commit`, item patch handlers. | Closes §4.8 drift risk.                                    |


### P1 — polish + recall value


| #    | Recommendation                                                                                                                                      | Where                                                                | Why                                                     |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------- |
| O-7  | Add a `phase` column + `progress` jsonb to `lore_import_jobs`; emit phases from `processLoreImportJob`; have UI render them.                        | `lore_import_jobs` schema, `lore-import-job-process.ts`, shell poll. | Builds trust on long jobs (§5.3).                       |
| O-8  | Add a cancel endpoint; check a `cancelled` flag between phases.                                                                                     | `/api/lore/import/jobs/[jobId]` PATCH, process loop.                 | Lets users abort (§5.4).                                |
| O-9  | Add dry-run mode to `/apply` (returns layout, links, merges without writes).                                                                        | `lore-import-apply.ts`, route param.                                 | Enables a real commit preview (§5.1).                   |
| O-10 | Collision-aware layout placer: offset origin into first clear rectangle by scanning existing items' `layout`.                                       | `lore-import-commit.ts` (`planLoreImportCardLayout`).                | Fixes overlap on busy canvases (§4.10).                 |
| O-11 | Persist `sourceChunkIds` on created items' `entity_meta.importProvenance` (chunk indexes only, not text).                                           | `lore-import-apply.ts`.                                              | Enables "show me the source" affordance (§5.11).        |
| O-12 | Register `"lore_source"` in `lore-object-registry.ts` (or rename it). Add conformance test that every persisted `entity_type` has a registry entry. | `lore-object-registry.ts`, a new test file.                          | Closes §4.5 and the data-pipeline audit §9 Critical #3. |
| O-13 | Use `canonicalEntityKind` in search/retrieval: boost matching kinds in RRF, expose as a search filter, include in Q&A prompt hints.                 | `app/api/search/route.ts`, `src/lib/lore-engine.ts`.                 | Makes ingestion taxonomy pay off at recall (§4.9).      |
| O-14 | When a cross-folder link is dropped, open a clarification (`link_semantics`, `severity=info`) with options: move, mention-as-prose, drop.           | `lore-import-plan-build.ts`, `lore-import-plan-llm.ts` clarify.      | Upgrades §4.4 from silent to interactive.               |


### P2 — strategic


| #    | Recommendation                                                                                                                              | Where                                                  | Why                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------- |
| O-15 | Plan-cache by (sha256(text), model) so clarification iteration doesn't re-pay outline/merge.                                                | `src/lib/lore-import-plan-cache.ts` (new).             | Halves iteration cost (§5.6).                   |
| O-16 | Replace 2-col grid with spatial hint from folder color/semantic family; cluster by `canonicalEntityKind`.                                   | `planLoreImportCardLayout`.                            | Better "first canvas impression" post-import.   |
| O-17 | Add retention jobs: TTL on `lore_import_jobs` ≥ 7 days with `status='ready'                                                                 | 'failed'`; cascade orphan` import_review_items`.       | New cron/after-job.                             |
| O-18 | Specialize shell rendering for `quest` (timeline/objectives) and `item` (artifact card) — unlocks the other half of the canonical taxonomy. | `src/components/foundation/lore/…`.                    | Removes §4.1 for the two biggest missing kinds. |
| O-19 | Add pre-submit cost estimate (chunks × expected LLM tokens) surfaced in the import modal; allow `maxCost` hint on job creation.             | `app/api/lore/import/jobs/route.ts` POST response, UI. | §5.5.                                           |
| O-20 | Pin Anthropic `temperature: 0.2` on outline + clarify; record model+seed in job row for reproducibility audits.                             | LLM callers in `lore-import-plan-llm.ts`.              | §5.6 determinism.                               |


## 7. Open questions for product

Please weigh in on these before we prioritize execution — they change the cost/value of the P0/P1 buckets.

1. **Specialized shells for `quest` / `item` / `lore`.** Are these worth designing, or do you prefer to collapse the canonical taxonomy down to `{character, faction, location, generic}` and stop the LLM from emitting the others? (Affects O-13, O-18, and whether §4.1 is a bug or a spec truncation.)
2. **Cross-space merges (§5.8).** Should merges into items in other folders/campaigns be allowed? The current behavior is permissive on merges but strict on links. Options: (a) keep as is, (b) restrict merges to same folder or ancestor chain, (c) gate cross-space merges behind a clarification prompt.
3. **Legacy `/extract`+`/commit` (§5.7).** Remove from UI, keep for MCP, or upgrade to match smart semantics?
4. **Undo granularity (O-4).** Is "delete all items + links from import batch X" sufficient, or do you want per-item accept/reject (the current `hgAiPending`/`aiReview` flow is item-level and does not remove, only marks)?
5. **Binding pre-population on import (O-3).** If a faction↔character `binding_hint` is detected, should we auto-add a roster row with `aiReview: pending`, or wait for the user to draw the thread? Trade-off: discoverability vs. noise for weak links.
6. **Cost ceiling (O-19).** Is there a per-import budget you want enforced (e.g., abort if estimated > $X)? Would shape O-19's UX.
7. **Retention (O-17).** How long should source text in `lore_import_jobs` and abandoned `import_review_items` live? 7 / 30 / 90 days?
8. **Provenance UI (O-11).** Do you want a "jump to source" affordance on every imported note, or only on merged ones? The first is heavier (needs a persisted source view); the second is cheap.
9. **Determinism (O-20).** Is reproducible planning desirable (pin temperature, record model) or do you value creative variation per run?
10. **Taxonomy visibility (O-13).** Would you use `canonicalEntityKind` as a search filter and Q&A bias, or do you think `entity_type` + folder is already enough?

## 8. Suggested execution order

1. **Week 1 (correctness):** O-1, O-2, O-6, O-12. Each is surgical and unlocks tests that will protect the rest.
2. **Week 2 (trust + safety):** O-3, O-4, O-5, O-7, O-8. User‑visible wins, limited surface.
3. **Week 3 (recall payoff):** O-9, O-10, O-11, O-13, O-14. Start paying dividends on all the classification the importer already does.
4. **Backlog:** O-15 through O-20 as the product matures and user feedback prioritizes.

Each recommendation has a concrete file to edit and a reachable test seam (the audit helpers under `src/lib/lore-import-*.ts` are already structured for unit tests; `lore-import-registry-wiring.test.ts` is the template for O-12).

## 9. Done criteria for this audit

- Goals/purpose reviewed against shipped features.
- Import pipeline (parse → plan → apply → reindex) mapped.
- Sort (folders/spaces), categorize (types/entity_meta), link (item_links / hgArch / prose) mapped.
- Mismatches, gaps, optimizations called out with file-level pointers.
- Open questions surfaced.
- Product review of §7; resulting decisions folded into the `[BUILD_PLAN.md](./BUILD_PLAN.md)` backlog alongside the P0/P1 items chosen.