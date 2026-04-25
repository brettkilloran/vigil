# Vercel first deploy — dashboard checklist

Use this **click-by-click** list only after skimming [`DEPLOY_VERCEL.md`](./DEPLOY_VERCEL.md). Check items off as you go.

**Role in the deploy set:** this file is the fast dashboard checklist, not the source of truth for env semantics or Neon branching.

**Need a different deploy doc?**

- **Start / full narrative:** [`DEPLOY_VERCEL.md`](./DEPLOY_VERCEL.md)
- **Exact env meanings:** [`VERCEL_ENV_VARS.md`](./VERCEL_ENV_VARS.md)
- **Neon Production + Preview setup:** [`NEON_VERCEL_SETUP.md`](./NEON_VERCEL_SETUP.md)
- **Post-deploy go-live audit:** [`GO_LIVE_REMAINING.md`](./GO_LIVE_REMAINING.md)

**Do not duplicate env semantics here.** Variable names, required combinations, and edge cases (e.g. Players PIN + optional player space UUID) are defined in **[`VERCEL_ENV_VARS.md`](./VERCEL_ENV_VARS.md)** — that file is the **source of truth**; this checklist and [`DEPLOY_VERCEL.md`](./DEPLOY_VERCEL.md) only repeat **what to click** and high-level groupings.

## A. Create the project

- [ ] [Vercel](https://vercel.com) → **Add New… → Project** → import the Git repo that contains **`heartgarden/`** (monorepo root is **not** the app folder).
- [ ] **Project name** (slug): e.g. **`heartgarden`** → default URL **`https://heartgarden.vercel.app`**.
- [ ] **Root Directory:** **`heartgarden`** (Edit → set folder; required for this repo).
- [ ] **Framework:** Next.js (auto).
- [ ] **Build Command:** leave override **empty** (uses [`vercel.json`](../vercel.json) → `pnpm run check`) **or** set explicitly to `pnpm run check`.
- [ ] **Install Command:** default **`pnpm install`** (or **`pnpm install --frozen-lockfile`** if you prefer and lockfile is healthy).
- [ ] **Output Directory:** default (Next.js).
- [ ] **Settings → General → Node.js Version:** **22.x** (matches CI) or **20.x** minimum.

## B. Git integration

- [ ] Connect **Production Branch** (usually **`main`**).
- [ ] Confirm pushes to that branch trigger a deployment.

## C. Environment variables (Production)

Add under **Project → Settings → Environment Variables**; mark sensitive values as **Sensitive**.

**Required for cloud sync (not demo mode):**

- [ ] `NEON_DATABASE_URL` — Neon **pooled / serverless** connection string → scope **Production** only first if you use a separate Preview DB later.

**Optional (same Production scope unless noted):**

- [ ] `ANTHROPIC_API_KEY` — lore Q&A + related routes.
- [ ] `ANTHROPIC_LORE_MODEL` — optional override.
- [ ] `OPENAI_API_KEY` — optional OpenAI embeddings for vault vectors / semantic search.
- [ ] `HEARTGARDEN_OPENAI_EMBEDDING_MODEL` — optional embedding model override.
- [ ] `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_BASE_URL` — if using uploads (see R2 CORS in [`DEPLOY_VERCEL.md`](./DEPLOY_VERCEL.md) §5).
- [ ] `HEARTGARDEN_LORE_QUERY_DISABLED=1` — optional; disables **`POST /api/lore/query`** until you add stronger access control (see [`DEPLOY_VERCEL.md`](./DEPLOY_VERCEL.md) §7).
- [ ] Boot PIN gate (optional): **`HEARTGARDEN_BOOT_SESSION_SECRET`** (16+ chars) + at least one of **`HEARTGARDEN_BOOT_PIN_BISHOP`** / **`HEARTGARDEN_BOOT_PIN_PLAYERS`** / **`HEARTGARDEN_BOOT_PIN_DEMO`** (each exactly **8** chars if set). Players-only is valid for a player-only deploy. If Players sign in, set **`HEARTGARDEN_PLAYER_SPACE_ID`** (see [`PLAYER_LAYER.md`](./PLAYER_LAYER.md)). See [`API.md`](./API.md) and [`VERCEL_ENV_VARS.md`](./VERCEL_ENV_VARS.md).
- [ ] **Optional multiplayer realtime:** Redis + **`HEARTGARDEN_REALTIME_REDIS_URL`**, **`HEARTGARDEN_REALTIME_SECRET`** (≥ 16 chars), **`HEARTGARDEN_REALTIME_URL`** (**`wss://`**) on Vercel; deploy **`pnpm run realtime`** separately with the same Redis and secret (see [`DEPLOY_VERCEL.md`](./DEPLOY_VERCEL.md) §5.5).

**Never set on Vercel:**

- [ ] Confirm **`PLAYWRIGHT_E2E`** is **not** set (would break bootstrap for real data and disables the boot PIN gate in **`/api/heartgarden/boot`**).

## D. Preview environment (isolated DB)

- [ ] In Neon: create a **second branch** (or DB) for PR previews — see [`NEON_VERCEL_SETUP.md`](./NEON_VERCEL_SETUP.md).
- [ ] In Vercel: add **`NEON_DATABASE_URL`** scoped to **Preview** only, using the **Preview** branch pooled URL (not Production’s).
- [ ] Run **`db:ensure-pgvector`** + schema setup against the Preview database from your machine (same doc).

## E. Domains (optional)

- [ ] **Settings → Domains** → add custom domain; complete DNS as instructed.

## F. R2 uploads (optional)

- [ ] All **`R2_*`** variables set on the right environment(s) — see [`VERCEL_ENV_VARS.md`](./VERCEL_ENV_VARS.md).
- [ ] **CORS** on the R2 bucket matches your **Production** (and **Preview**) browser origins — copy/adapt the JSON example in [`DEPLOY_VERCEL.md`](./DEPLOY_VERCEL.md) §5.
- [ ] Smoke: upload an image from the app; confirm object is readable via **`R2_PUBLIC_BASE_URL`**.

## G. Smoke test after first successful deploy

- [ ] Open production URL → shell loads.
- [ ] **`GET /api/bootstrap`** → `demo: false` when Production `NEON_DATABASE_URL` is correct.
- [ ] If Anthropic set and **`HEARTGARDEN_LORE_QUERY_DISABLED`** is not `1`: Cmd+K → **Ask lore** once.

## H. Public URL hardening (choose before wide sharing)

- [ ] Turn on **Vercel Deployment Protection** for Preview (and Production if needed) — see [`DEPLOY_VERCEL.md`](./DEPLOY_VERCEL.md) §7.
- [ ] Or set **`HEARTGARDEN_LORE_QUERY_DISABLED=1`** until auth / global rate limits (e.g. KV) exist.
- [ ] Set **billing alerts / caps** on Anthropic.
