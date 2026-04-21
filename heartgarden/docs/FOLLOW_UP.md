---
title: heartgarden — follow-ups
status: supporting
audience: [human]
last_reviewed: 2026-04-10
related:
  - heartgarden/docs/BUILD_PLAN.md
  - heartgarden/docs/VERCEL_ENV_VARS.md
---

# heartgarden — follow-ups (human / account / infra)

**Scope:** Credentials, dashboards, and operational steps the codebase **cannot** complete without you. **Ordered engineering work, phases, and shipped-vs-open features** live only in **`docs/BUILD_PLAN.md`** — this file does **not** duplicate that backlog.

**Env definitions (names, semantics, edge cases):** **`docs/VERCEL_ENV_VARS.md`** — do not maintain a parallel matrix here.

---

## Accounts & API keys

- **Neon:** `NEON_DATABASE_URL` in `.env.local` (and Vercel) for cloud sync, search, graph, MCP against production. Enable **`CREATE EXTENSION vector`** before schema that uses embeddings (`npm run db:ensure-pgvector` from app root **`heartgarden/`**; see **`docs/NAMING.md`** if you rename the folder).
- **Anthropic:** `ANTHROPIC_API_KEY` for **`POST /api/lore/query`**, lore import extract, per-item lore meta on vault index, **Ask lore**. Optional: `ANTHROPIC_LORE_MODEL`. **Unauthenticated** today — baseline IP rate limit in `lore-query-rate-limit.ts`; add auth or edge protection before a wide public URL. Optional kill-switch: **`HEARTGARDEN_LORE_QUERY_DISABLED=1`** on Vercel → **`503`** on lore query (see **`docs/DEPLOY_VERCEL.md`**).
- **Vector embeddings:** Not wired to an external API in this repo (`src/lib/embedding-provider.ts`). Hybrid / semantic search use lexical fusion until a provider is added.
- **Vault env (optional):** `HEARTGARDEN_VAULT_DEBUG`, `HEARTGARDEN_INDEX_AFTER_PATCH`, `HEARTGARDEN_INDEX_SKIP_LORE_META` — see **`heartgarden/AGENTS.md`** (vault / index) and **`.env.local.example`**.
- **Cloudflare R2:** Bucket, CORS, optional public URL for image uploads; align with **`.env.local.example`**.

---

## CI & repo

- **GitHub Actions:** **`.github/workflows/heartgarden-ci.yml`** (repo root). Runs `npm run check`, Storybook build, Playwright from **`heartgarden/`**. Enable Actions if disabled; update paths if you rename **`heartgarden/`** (**`docs/NAMING.md`**).
- **Manual DB vault workflow:** **`.github/workflows/heartgarden-db-vault.yml`** — add secret **`HEARTGARDEN_NEON_DATABASE_URL`**. Runs **`npm run db:vault-setup`** in **`heartgarden/`**; does **not** run reindex or set API keys.

---

## Database & Neon hygiene

- **`canvas_presence`:** Required in Postgres for **`/api/spaces/[spaceId]/presence`**. Created by both **`npm run db:push`** (schema) and **`drizzle/migrations/0009_canvas_presence.sql`** (replayed by **`db:vault-sql`**). Legacy **`space_presence`** is obsolete; code uses **`canvas_presence`** only.
- **Legacy `canvas_state`:** Old DBs may still hold full tldraw JSON — migrate or reset per **`docs/STRATEGY.md`** / **`docs/MIGRATION.md`**.
- **Vault setup:** **`npm run db:vault-setup`** from **`heartgarden/`** (pgvector + Drizzle push + SQL migration replay). **`db:vault-sql`** iterates every **`drizzle/migrations/*.sql`** in lex order; each file is idempotent, so running setup on each environment (local, Preview, Production) after schema / migration changes is safe and required. See **`heartgarden/AGENTS.md`** for full sequence.
- **Vault reindex:** **`npm run vault:reindex`** (app running) refreshes per-item index / lore meta per implementation. Optional: **`VAULT_REINDEX_*`**, **`HEARTGARDEN_APP_URL`**, **`VAULT_REINDEX_DRY=1`**.

---

**Execution backlog:** **`docs/BUILD_PLAN.md`**
