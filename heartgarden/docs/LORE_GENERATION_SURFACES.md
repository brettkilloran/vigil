---
title: Lore generation surfaces — feature brief
status: draft
audience: [agent, human]
last_reviewed: 2026-04-25
related:
  - heartgarden/docs/BACKLOG.md
  - heartgarden/docs/LORE_ENGINE_ROADMAP.md
  - heartgarden/docs/EDITOR_HG_DOC.md
  - heartgarden/docs/BINDINGS_CATALOG.md
  - heartgarden/docs/RELATIONSHIP_VOCABULARY.md
  - heartgarden/docs/LORE_IMPORT_KIND_MAPPING.md
---

# Lore generation surfaces — feature brief

**Status:** Captured 2026-04-25 from a triage chat. **Not scheduled.** Filed in `BACKLOG.md` (Mid-term, Phase 5 — TTRPG + intelligence). This is a design brief, not a plan: when work starts, draft a `.cursor/plans/lore_generation_surfaces.plan.md` derived from §6 below.

## 1. One-liner

Make heartgarden a *living codex* by turning the existing AI plumbing (Anthropic client, hybrid retrieval, `hgAiPending` review lifecycle, structured bindings, canonical entity kinds) into a small set of **author-facing generation surfaces** — inline AI in prose, per-slot field suggesters, world-style name generation, whole-entity scaffolders, and consistency nudges — all reviewable, grounded, and reversible.

## 2. Why now / why this brief exists

The user asked: *"Will there be a way to generate new content or make suggestions in app — maybe fill fields like a random name generator that fits the game world, dynamically? I want a living codex that's easy to expand as a writer."*

The codebase already has every primitive needed; what's missing is intentional **author-facing surfaces** layered on top. This brief enumerates those surfaces so a future planning pass can pick them up without re-deriving the analysis.

## 3. Scaffolding that already exists (anchors)

| Capability | Where |
|---|---|
| LLM client with JSON, retries, thinking budget, prompt caching, labels | `src/lib/anthropic-client.ts` (`callAnthropic`, `buildCachedSystem`, `MAX_OUTPUT_TOKENS_BY_LABEL`) |
| Grounded retrieval (hybrid + 1-hop graph + prose `vigil:item` + hgArch binding neighbors) | `src/lib/lore-engine.ts` (`retrieveLoreSources`), `src/lib/vault-retrieval.ts` (`hybridRetrieveItems`, `expandLinkedItems`, `expandProseLinkedItems`, `expandHgArchBindingNeighbors`) |
| Pending-review lifecycle for AI prose | `src/lib/hg-doc/hg-ai-pending-mark.ts`, `collect-hg-ai-pending-ranges.ts`, `remove-hg-ai-pending-range.ts`, `strip-hg-ai-pending.ts`; `HgAiPendingEditorGutter.tsx` |
| Card-level review state | `entity_meta.aiReview` (`pending` / `accepted`) — schema in `src/lib/entity-meta-schema.ts`; chip UX in `ArchitecturalNodeCard.tsx` + `acceptAiReviewForEntity` in `ArchitecturalCanvasApp.tsx` |
| Structured slot vocabulary (typed targets) | `src/lib/bindings-catalog.ts` (`BINDING_SLOT_DEFINITIONS`, `targetEntityTypes`, `mirrorCanvasConnection`) |
| Canonical entity kinds | `src/lib/lore-import-canonical-kinds.ts` (`CANONICAL_ENTITY_KINDS`) |
| Relationship vocabulary | `src/lib/lore-link-types.ts` (`LORE_LINK_TYPE_OPTIONS`); semantics in `docs/RELATIONSHIP_VOCABULARY.md` |
| Existing import scaffold (extract → plan → apply, with pending wrap + `linkIntent: binding_hint`) | `src/lib/lore-import-extract.ts`, `lore-import-plan-llm.ts`, `lore-import-apply.ts`, `lore-import-apply-bindings.ts`, `lore-import-commit.ts` |
| Slash command menu | `src/lib/default-slash-commands.ts` (`DEFAULT_SLASH_COMMAND_ITEMS`); dispatch in `ArchitecturalCanvasApp` `runFormat` |
| Wiki link assist (good "no match" entry point) | `src/components/.../WikiLinkAssistPopover.tsx`, `src/lib/wiki-link-caret.ts` |
| Seeded HTML scaffolds with placeholder spans | `src/lib/lore-node-seed-html.ts` (character v11, faction v1–v3, location ORDO v7) |
| Roster schema (typed structured target) | `src/lib/faction-roster-schema.ts` |
| Consistency check (LLM, today batch-only) | `src/lib/lore-consistency-check.ts` |
| MCP write tools (already programmatic) | `heartgarden_create_item`, `heartgarden_patch_item`, `heartgarden_create_link` (see `src/lib/mcp/heartgarden-mcp-server.ts`) |
| Status bus for "indexing / generating" chrome | `src/lib/vault-index-status-bus.ts`, `ArchitecturalStatusBar.tsx` |

## 4. Design principles (non-negotiable invariants)

These match the import pipeline's existing posture and are what keep the codex trustworthy:

1. **Never silent.** All AI output starts as `hgAiPending` spans or `entity_meta.aiReview = "pending"`. The existing gutter **Bind** + card **Unreviewed/Accept** chips are the universal "handle AI" surface. No new accept UX is introduced.
2. **Grounded by default.** Generators share `retrieveLoreSources` + `expandHgArchBindingNeighbors`. There are no "blank LLM" buttons; every prompt carries the world's voice.
3. **Typed outputs.** All new endpoints use `callAnthropic({ expectJson: true })` with Zod-validated payloads. New schemas live alongside `entity-meta-schema.ts` and `faction-roster-schema.ts`.
4. **Provenance recorded.** Reuse `importProvenance` (or a peer field) with a `generator` discriminator so every accepted AI span traces back to prompt + source itemIds.
5. **Reversible.** Writes go through `architectural-neon-api.ts` so undo/redo, the conflict banner, and delta sync all already work. Generators must not bypass that path.
6. **Budgeted.** Each new route gets a `lore-query-rate-limit.ts`-style limiter and a distinct entry in `MAX_OUTPUT_TOKENS_BY_LABEL`. Optional kill-switch env var (`HEARTGARDEN_LORE_GENERATE_DISABLED=1`) parallel to `HEARTGARDEN_LORE_QUERY_DISABLED`.
7. **Cross-space discipline.** Suggestions for binding slots respect `CROSS_SPACE_LINK_POLICY = "same_space_only"`. Candidates outside the current `space_id` are filtered.

## 5. Surfaces (the actual feature set)

### 5.1 Inline AI in the hgDoc editor (`/ai …`)

Extend `DEFAULT_SLASH_COMMAND_ITEMS` with a small `ai:*` family dispatched in `ArchitecturalCanvasApp` `runFormat`. Output is wrapped in `hgAiPending` so the gutter handles review.

- `/ai continue` — generate the next paragraph from the current cursor, grounded in the card's neighbors.
- `/ai rewrite` — rewrite the selection in the voice of the current card and its space.
- `/ai describe` — one-shot description from `title` + `entity_type` + binding neighbors.
- **Ghost text** on idle caret: predict one sentence, render with `--sem-text-ai-pending` styling (already defined in `app/globals.css`), accept with Tab.

**Cost:** small. Reuses gutter, mark, status bus.

### 5.2 Per-slot "Suggest" affordance on structured cards

A sparkle button on each `BINDING_SLOT_DEFINITIONS` slot (e.g. `faction.parentNation`, `character.primaryLocations`, `location.linkedCharacters`).

```text
POST /api/lore/suggest-field
{ itemId, slotId }
→ { candidates: Array<{ kind: "existing", itemId, title, score, why } | { kind: "propose-new", title, draftSummary }>, sources: [...] }
```

Server logic:
1. Load card; resolve `targetEntityTypes` from `BINDING_SLOT_DEFINITIONS`.
2. Run `retrieveLoreSources` scoped to `space_id` + filter by `entity_type`.
3. Rank existing items first (typed candidates), then a typed proposal for a new entity if the model thinks one is missing.
4. UI: small picker; "Create new ___" path drops a pending stub via `heartgarden_create_item` with `aiReview: "pending"`.

Importantly the response shape **cannot** be free text — it can only be existing-item references or typed new-entity proposals. That's what stops the codex from drifting.

### 5.3 Name-style generator that fits the world

The trick is **style context**, not a smarter model.

Convention: a per-space "voice" card (`entity_type: "lore"`, `entity_meta.styleGuide: true`) holds tone / phonotactics / dos-and-don'ts. The endpoint:

```text
POST /api/lore/generate-names
{ spaceId, kind: "npc"|"location"|"faction", count?: 8, seedHint?: string }
→ { names: Array<{ name, blurb? }>, sources: [...] }
```

Server pulls existing item titles of that `entity_type` in the space (the corpus), plus any `styleGuide` cards, and asks Anthropic for N candidates. Label `lore.generate.names`, JSON expected.

Wiring entry points:
- `WikiLinkAssistPopover` "no match" state: add **"✨ Generate names that fit this world"** alongside the existing "Create '<query>'" affordance.
- Empty title field on a freshly-created lore card: same picker.
- Cmd+K palette action `ai:generate-names <kind>`.

### 5.4 Whole-entity scaffolders ("Organization (AI)", "Character (AI)")

Add a sibling to the existing dock variants in `ArchitecturalBottomDock.tsx` (`DEFAULT_CREATE_ACTIONS` / `loreVariantSubmenu`) — same UX as picking a layout variant, just AI-seeded.

```text
POST /api/lore/scaffold-entity
{ spaceId, kind: CanonicalEntityKind, hint: string, neighborItemIds?: string[] }
→ { itemDraft: { title, contentHtml, hgArch?, entityMeta }, suggestedLinks: Array<{ targetItemId, linkType, linkIntent: "binding_hint" }> }
```

Server output:
- `title` from §5.3 generator
- `contentHtml` seeded from the appropriate variant in `lore-node-seed-html.ts` with **placeholder text replaced by `hgAiPending` spans**
- For factions: a draft `hgArch.factionRoster` (validated by `faction-roster-schema.ts`) populated with existing characters when plausible, `unlinked` rows otherwise
- `suggestedLinks` with `linkIntent: "binding_hint"` — the existing import path (`lore-import-apply-bindings.ts`) already knows what to do with those, GM confirms on-card before hgArch is written

Result: one Accept walk-through and you've absorbed an AI's pitch.

### 5.5 Codex-level generators (worldbuilding moves)

These are orchestrations over the primitives above:

- **"Populate this location"** on a location card → 3–6 NPC stubs + roster rows pre-linked via `location.linkedCharacters` + mirrored `item_links`. All pending.
- **"Invent a rival"** on a faction → new faction + a `conflict` edge (canonical from `LORE_LINK_TYPE_OPTIONS`).
- **"Sketch a timeline"** on a space → reads event-tagged items, proposes connective events as new pending cards.

No new lower-level capability — just buttons that compose §5.2 / §5.3 / §5.4.

### 5.6 Live consistency nudges

Promote `lore-consistency-check.ts` from one-shot to ambient.

- On debounced save of a card with pending spans, schedule a `lore.consistency` call comparing the new text against retrieved neighbors.
- Surface results as **margin comments next to the gutter Bind button**: *"This contradicts [[High Sept of Ilmar]] — accept, edit, or open source."*
- Wire status to `vault-index-status-bus.ts` so the existing status strip already accommodates it.

### 5.7 Palette + MCP parity

Every generator is exposed three ways so the codex is *actually* living:

1. **In the editor** — slash commands + gutter (§5.1).
2. **Cmd+K palette** — extend `paletteActions` / `runPaletteAction` next to existing `create:*` entries with `ai:*`.
3. **MCP** — new tools `heartgarden_suggest_field`, `heartgarden_generate_names`, `heartgarden_scaffold_entity`. Writes flow back through Neon → `GET …/changes` → realtime invalidation, so external scripts (or Claude Desktop) light up the same canvas in real time.

## 6. Suggested build order (when this is picked up)

When this lands in a sprint, draft `.cursor/plans/lore_generation_surfaces.plan.md` with these phases:

1. **`/ai continue` + `/ai rewrite`** in hgDoc, reusing `hgAiPending` and gutter. Smallest, highest-leverage; proves the reviewable generation loop end-to-end.
2. **`POST /api/lore/generate-names`** + `WikiLinkAssistPopover` "no match" wiring. Immediate worldbuilder joy, no schema changes.
3. **Per-slot "Suggest" picker** (§5.2). First server route that uses `BINDING_SLOT_DEFINITIONS` as a typed output constraint.
4. **`scaffold-entity` endpoint + dock "(AI)" variants** (§5.4). Pending-everything; users walk through Accepts.
5. **Live consistency nudges** (§5.6).
6. **MCP tool parity** (§5.7).

Each phase should land with: rate limiter, label entry in `MAX_OUTPUT_TOKENS_BY_LABEL`, kill-switch env, Zod schema, unit test for the parsed JSON, and docs row in `FEATURES.md` + `CODEMAP.md`.

## 7. Open questions

1. **Style-guide card discovery.** Convention via `entity_meta.styleGuide: true`, or a dedicated table column? Convention is cheaper and survives schema; column gives the UI a definite home.
2. **Cost ceiling.** Should generation routes share a single budget with `lore.query.*`, or get their own? Probably their own so heavy authoring sessions can't starve Ask lore.
3. **Pending span granularity.** Should `/ai continue` wrap the whole inserted paragraph, or sentence-by-sentence (so reviewers can Accept partials)? The gutter currently treats one mark range as one unit.
4. **Cross-space generation.** Same-space only at first (matches `CROSS_SPACE_LINK_POLICY`). Revisit only if multi-world coordination becomes a real workflow.
5. **Name-generator vs imported names.** Should the generator know about archived items so it doesn't propose names that were retired? Probably yes — read `item_archive` filter when assembling the corpus.

## 8. Non-goals

- No "blank slate" generators (no button that writes lore without retrieval grounding).
- No silent writes — everything is `hgAiPending` / `aiReview: "pending"` until human-Accepted.
- No new accept UX — strictly reuse the gutter and card chip.
- No CRDT for AI suggestions — last-write-wins through existing PATCH path is enough.
- No agent autonomy beyond a single user-initiated request — no background generation loops in v1.
