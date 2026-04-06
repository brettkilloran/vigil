# heartgarden — follow-ups (human / account / infra)

Items the codebase **cannot** complete without your action, credentials, or product decisions. Check off as you go.

## Accounts & API keys

- **Neon:** `NEON_DATABASE_URL` in `.env.local` (and Vercel) for cloud sync, search, graph, MCP against production. Enable **`CREATE EXTENSION vector`** on the database before pushing schema with embeddings (`npm run db:ensure-pgvector` from the app root — currently **`vigil/`**; see **`docs/NAMING.md`** if you rename the folder).
- **Anthropic:** `ANTHROPIC_API_KEY` for **`POST /api/lore/query`**, lore import extract, **per-item lore summary/aliases on vault index** (`lore-item-meta.ts`), and **Ask lore** (`LoreAskPanel`). Optional: `ANTHROPIC_LORE_MODEL` (default `claude-sonnet-4-20250514`). **Unauthenticated** today — baseline IP rate limit is in `lore-query-rate-limit.ts`; add auth or edge protection before a public URL. Optional kill-switch: **`HEARTGARDEN_LORE_QUERY_DISABLED=1`** on Vercel makes **`/api/lore/query`** return **503** (see [`DEPLOY_VERCEL.md`](./DEPLOY_VERCEL.md) §7).
- **OpenAI (embeddings):** `OPENAI_API_KEY` enables **chunk embeddings** and **hybrid / semantic search** + richer lore retrieval. Optional `HEARTGARDEN_EMBEDDING_MODEL` (default `text-embedding-3-small`, 1536 dims). Without it, search stays lexical-only and index routes skip vector rows.
- **Vault env (optional):** `HEARTGARDEN_VAULT_DEBUG=1` logs hybrid fusion (RRF) diagnostics. `HEARTGARDEN_INDEX_AFTER_PATCH=1` runs **`after()`** reindex from item PATCH/create (see `schedule-vault-index-after.ts`). `HEARTGARDEN_INDEX_SKIP_LORE_META=1` saves Anthropic calls on bulk reindex (vectors only unless the API passes `refreshLoreMeta: true`).
- **Cloudflare R2:** Bucket, CORS, and optional public URL for image uploads; align with `.env.local.example`.

## Phase 5 (plan) — still LLM- or product-heavy

- **Markdown bulk import + entity extraction:** Needs an LLM pipeline (or a manual wizard) you trust; not implemented server-side beyond REST shapes.
- **Auto-linking** (suggest `[[` targets from mentions): Needs embeddings or LLM + UX for accept/reject.
- **Lore consistency checker** (“does anything contradict …?”): Needs LLM reasoning or a curated rules engine. **Partial stand-in:** **`/api/lore/query`** answers from **hybrid-retrieved** excerpts (FTS + vectors + links); not a full contradiction engine across the whole graph.
## Phase 6–7 — visual / typography

- **Commercial font parity** (Eina 03, etc.): App shell uses **Geist** + **Lora** (editor headings); licensing for Spatial-like fonts is on you if you want pixel-match.
- **Flower color picker** (card themes / chrome — not the boot **`VigilBootFlowerGarden`** decor), **dual-layer shadow tuning**, **expanded note fullscreen** transition polish: larger UI passes; partially addressed via tokens and glass panels.
- **Custom caret**, **checkbox asset-perfect** match: optional follow-up.

## Phase 8 — performance & shipping

- **Image thumbnails by zoom level:** Requires R2 transforms or a resize pipeline.
- **Bundle budget (<200KB initial):** Run `ANALYZE` / `next build` analysis when you care about the number.
- **Canvas minimap:** Not built; add if you want orientation at a glance.
- **Onboarding overlay:** First-run hints not implemented.
- **Preferences panel** (corner radius, spring sliders): Only theme + snap exist in toolbar; extend `localStorage` / store if you want full prefs.
- **PWA offline caching:** Service worker is **minimal** (install + claim only); define cache strategy before relying on offline edits.

## CI / repo

- **GitHub Actions:** Workflow lives at **`.github/workflows/heartgarden-ci.yml`** (repository root). It runs `npm run check`, Storybook build, and Playwright from the **`vigil/`** working directory. Enable Actions on the repo if disabled; update path filters and `working-directory` if you rename **`vigil/`** (see **`docs/NAMING.md`**).
- **Manual DB vault setup (CI):** Workflow **`.github/workflows/heartgarden-db-vault.yml`** — **Actions → heartgarden DB vault setup → Run workflow**. Add repo secret **`HEARTGARDEN_NEON_DATABASE_URL`** (same value as `NEON_DATABASE_URL`). It runs **`npm run db:vault-setup`** in **`vigil/`** (pgvector + `drizzle-kit push --force` + vault SQL). Does **not** run reindex or set API keys.

## Database hygiene

- **`space_presence` table:** Multiplayer **presence** heartbeats require this table in Postgres. After upgrading schema, run **`npm run db:push`** from **`vigil/`** (or your usual Drizzle migration path) so `POST/GET /api/spaces/[spaceId]/presence` succeed.
- **Legacy `canvas_state`:** If an old DB still stores full tldraw JSON, migrate or reset per `STRATEGY.md`.
- **Vault schema + SQL (automated locally):** From **`vigil/`**, **`npm run db:vault-setup`** runs **`db:ensure-pgvector`**, **`db:push:force`**, and **`db:vault-sql`** (`scripts/vault-sql-migrate.mjs` applies **`drizzle/migrations/0003_vault_embeddings_lore_meta.sql`** with an HNSW fallback). For interactive pushes without `--force`, keep using **`npm run db:push`** alone.
- **Backfill embeddings:** With the app running (`npm run dev` or `npm start`) and **`OPENAI_API_KEY`** set for the server, run **`npm run vault:reindex`** (`scripts/vault-reindex-all.mjs`). Optional env: **`VAULT_REINDEX_SPACE_ID`**, **`VAULT_REINDEX_SKIP_LORE=1`**, **`HEARTGARDEN_APP_URL`**, **`VAULT_REINDEX_DRY=1`** (count only).

---

**Execution checklist:** `docs/BUILD_PLAN.md`

*Last updated by agent pass (living document; edit freely).*
