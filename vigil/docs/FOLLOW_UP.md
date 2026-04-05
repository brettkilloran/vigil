# heartgarden — follow-ups (human / account / infra)

Items the codebase **cannot** complete without your action, credentials, or product decisions. Check off as you go.

## Accounts & API keys

- **Neon:** `NEON_DATABASE_URL` in `.env.local` (and Vercel) for cloud sync, search, graph, MCP against production. Enable **`CREATE EXTENSION vector`** on the database before pushing schema with embeddings (`npm run db:ensure-pgvector` from the app root — currently **`vigil/`**; see **`docs/NAMING.md`** if you rename the folder).
- **Anthropic:** `ANTHROPIC_API_KEY` for **`POST /api/lore/query`**, lore import extract, and the **Ask lore (AI)** UI (`LoreAskPanel`). Optional: `ANTHROPIC_LORE_MODEL` (default `claude-sonnet-4-20250514`). **Unauthenticated** today — rate-limit or protect before a public URL.
- **Cloudflare R2:** Bucket, CORS, and optional public URL for image uploads; align with `.env.local.example`.

## Phase 5 (plan) — still LLM- or product-heavy

- **Markdown bulk import + entity extraction:** Needs an LLM pipeline (or a manual wizard) you trust; not implemented server-side beyond REST shapes.
- **Auto-linking** (suggest `[[` targets from mentions): Needs embeddings or LLM + UX for accept/reject.
- **Lore consistency checker** (“does anything contradict …?”): Needs LLM reasoning or a curated rules engine. **Partial stand-in:** **`/api/lore/query`** answers from retrieved canvas excerpts (FTS); not a full contradiction engine across the whole graph.
- **Dual canvas state:** Some panels still use **`canvas-store`** while the main shell is **`ArchitecturalCanvasApp`** — unify or document (see **`docs/BUILD_PLAN.md`**).

## Phase 6–7 — visual / typography

- **Commercial font parity** (Eina 03, etc.): App shell uses **Geist** + **Lora** (editor headings); licensing for Spatial-like fonts is on you if you want pixel-match.
- **Flower color picker**, **dual-layer shadow tuning**, **expanded note fullscreen** transition polish: larger UI passes; partially addressed via tokens and glass panels.
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

## Database hygiene

- **Legacy `canvas_state`:** If an old DB still stores full tldraw JSON, migrate or reset per `STRATEGY.md`.

---

**Execution checklist:** `docs/BUILD_PLAN.md`

*Last updated by agent pass (living document; edit freely).*
