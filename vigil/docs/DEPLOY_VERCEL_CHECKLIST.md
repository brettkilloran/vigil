# Vercel first deploy — dashboard checklist

Use this **click-by-click** list with the narrative in [`DEPLOY_VERCEL.md`](./DEPLOY_VERCEL.md). Check items off as you go.

**Env scope matrix:** [`VERCEL_ENV_VARS.md`](./VERCEL_ENV_VARS.md).

## A. Create the project

- [ ] [Vercel](https://vercel.com) → **Add New… → Project** → import the Git repo that contains **`vigil/`** (monorepo root is **not** the app folder).
- [ ] **Project name** (slug): e.g. **`heartgarden`** → default URL **`https://heartgarden.vercel.app`**.
- [ ] **Root Directory:** **`vigil`** (Edit → set folder; required for this repo).
- [ ] **Framework:** Next.js (auto).
- [ ] **Build Command:** leave override **empty** (uses [`vercel.json`](../vercel.json) → `npm run check`) **or** set explicitly to `npm run check`.
- [ ] **Install Command:** default **`npm install`** (or **`npm ci`** if you prefer and lockfile is healthy).
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
- [ ] `OPENAI_API_KEY` — semantic search / embeddings.
- [ ] `HEARTGARDEN_EMBEDDING_MODEL` — optional.
- [ ] `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_BASE_URL` — if using uploads (see R2 CORS in [`DEPLOY_VERCEL.md`](./DEPLOY_VERCEL.md) §5).
- [ ] `HEARTGARDEN_LORE_QUERY_DISABLED=1` — optional; disables **`POST /api/lore/query`** until you add stronger access control (see [`DEPLOY_VERCEL.md`](./DEPLOY_VERCEL.md) §7).
- [ ] Boot PIN gate (optional): **`HEARTGARDEN_BOOT_SESSION_SECRET`** (16+ chars) + at least one of **`HEARTGARDEN_BOOT_PIN_ACCESS`** / **`HEARTGARDEN_BOOT_PIN_VISITOR`** (each exactly **8** chars if set). Visitor-only is valid for a player-only table. If visitors sign in, set **`HEARTGARDEN_PLAYER_SPACE_ID`** (see [`PLAYER_LAYER.md`](./PLAYER_LAYER.md)). See [`API.md`](./API.md) and [`VERCEL_ENV_VARS.md`](./VERCEL_ENV_VARS.md).

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
- [ ] Set **billing alerts / caps** on Anthropic and OpenAI.
