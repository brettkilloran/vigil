# heartgarden — execution build plan (living)

This is the **repo-wide checklist**: architecture snapshot, shipped tranches, and backlog (hardening, dual state, embeddings, e2e, later phases). **Ordered lore-engine work** (import pipeline, link phases, MCP expansion) lives in the **Cursor plan** `heartgarden_lore_engine_7fc1fb56.plan.md` under `.cursor/plans/` — treat that as the completion ledger for Phases A–D + UX2 unless you explicitly reprioritize here.

**Historical product bible** (Spatial-style sessions, old paths): **`docs/archive/vigil-master-plan-legacy.md`**. Stub at **`VIGIL_MASTER_PLAN.md`** points there. Honest engineering delta: **`STRATEGY.md`**. Human / account items: **`FOLLOW_UP.md`**.

## Architecture snapshot (verify after each large merge)

| Layer | Location / notes |
|--------|------------------|
| **Production canvas shell** | `ArchitecturalCanvasApp` + `src/components/foundation/*` — mounted from `app/_components/VigilApp.tsx`. |
| **Graph state** | In-component React state + **undo/redo** stack (`architectural-undo.ts`); Neon sync via `architectural-db-bridge.ts`, `architectural-neon-api.ts`, `/api/bootstrap`, item/space routes. |
| **Save / sync indicator** | `neon-sync-bus.ts` + instrumented `architectural-neon-api.ts` + debounced note body bumps. Status strip in **`ArchitecturalStatusBar`**: Loading → Local (demo) → Saving… → Saved / Sync error. Tooltips document **undo vs server** semantics. |
| **Legacy zustand canvas** | `src/stores/canvas-store.ts` — still imported by some **panels** (e.g. backlinks, timeline, tool rail variants). Not the source of truth for the architectural shell. Unify or keep documented until panels are rewired. |
| **Search** | Postgres FTS + trigram on `search_blob`; optional **OpenAI** query/item embeddings for hybrid/semantic (`/api/search`, `/api/search/suggest`, `item-embedding.ts`). |
| **Lore Q&A (MVP)** | `POST /api/lore/query` — retrieval via FTS (+ fuzzy fallback), synthesis via **Anthropic** (`ANTHROPIC_API_KEY`, optional `ANTHROPIC_LORE_MODEL`). UI: Cmd+K → **Ask lore (AI)** → `LoreAskPanel`. |
| **DB** | Drizzle `src/db/schema.ts`; Neon requires **`CREATE EXTENSION vector`** before push (`npm run db:ensure-pgvector`). |

**Health check:** From `vigil/`, run `npm run check` (lint + production build). After UX / DB / stacking changes, run `npm run test:unit` and targeted `npm run test:e2e` if flows touched.

---

## Completed tranches (plan remains valid)

These align with the **legacy** master plan phases 1–4 in substance (see **`docs/archive/vigil-master-plan-legacy.md`**), even where that doc still says `VigilCanvas` / `components/canvas/`.

| Tranche | Notes |
|---------|--------|
| Custom DOM surface (no tldraw) | Transform-based pan/zoom, cards, folders, stacks, connections. |
| Drizzle + Neon + pgvector | `spaces`, `items`, `item_links`, `item_embeddings`; self-FK on `spaces.parent_space_id`. |
| **Neon persistence bridge** | Bootstrap hydrate, create/patch/delete items & spaces, camera persistence, folder child spaces (Phase “A” in recent work). |
| Cmd+K palette | Local filter + `/api/search/suggest`, spaces, actions, recent items. |
| **Lore engine (v1)** | Server: `src/lib/lore-engine.ts` + `/api/lore/query`. Client: `LoreAskPanel`. |
| **Neon save indicator** | Live sync line in status bar; tracks in-flight mutations + debounced content patches. |
| CI / Storybook | `npm run check`; Storybook in CI per `AGENTS.md`. |

*Recent batches (UX, seed data, stacking):* they refine the shell above and **do not invalidate** the master phase map—re-run checks and e2e smoke after merges.

---

## Next execution phases (ordered)

### Near-term — hardening & parity

1. **Dual state story** — Either migrate timeline/backlinks (and related UI) to architectural graph + Neon IDs, or keep an explicit “legacy panel” note in `AGENTS.md` until done.
2. **`POST /api/lore/query` abuse** — Before a public URL: rate limiting, auth, or Vercel firewall; unauthenticated calls consume Anthropic quota.
3. **Embeddings strategy** — Today: OpenAI `text-embedding-3-small` (1536-dim) for `item_embeddings` + hybrid search. Changing provider requires matching **vector dimension** or a migration.
4. **E2E** — Optional: palette → lore panel smoke (skip or mock LLM in CI).
5. **Canvas version history (not started)** — Product “version control” options to evaluate:
   - **Space / graph snapshots** — periodic or manual rows (JSON blob or item version table) + “Restore snapshot” (conflicts with current undo stack — need UX).
   - **Per-item revision log** — append-only `item_revisions` on each PATCH (storage heavy; query for diff UI).
   - **Git export** — canonical files on disk for power users (out of app scope vs in-app timeline).
   - **Undo vs DB:** Today **undo is local-only**; Neon holds the **last successful write**. Any future “revert server to match undo” would be an explicit sync action.

### Mid-term — master plan Phase 5 (TTRPG + intelligence)

Matches **legacy** Phase 5 themes and **`FOLLOW_UP.md`** LLM items (see archive master plan for original wording):

- Markdown bulk import + entity extraction pipeline.
- Auto-linking (suggest `[[` targets) with review UX.
- Deeper graph/timeline integration with persisted `item_links` and UUID stability everywhere.
- Lore consistency checker (LLM).

### Later — Phases 6–8 + `VISUAL_REVAMP_PLAN`

- Visual/typography polish, performance (culling, bundle), PWA/offline strategy, prefs — per legacy master plan + **`FOLLOW_UP.md`**.

---

## Legacy session list (`docs/archive/vigil-master-plan-legacy.md`)

The numbered **Sessions 1–38** there are **historical ordering guidance** only. Execution status is tracked **here**, in the **Cursor lore plan** (Phases B–D), and in **`STRATEGY.md`**.

### Stub at `VIGIL_MASTER_PLAN.md`

The path is kept so old links work; it redirects to **`docs/archive/vigil-master-plan-legacy.md`** for the full text. For *what to build next*, prefer the **Cursor plan** + this file.

---

*Living document — edit when shipping or reprioritizing.*
