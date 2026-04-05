# Deploy heartgarden on Vercel

This is the **step-by-step** companion to the short notes in [`README.md`](../README.md). I can’t log into your Vercel or Neon accounts from here; use this as a checklist while you click through the dashboards (or run the Vercel CLI on your machine after `vercel login`).

## 1. What you’re deploying

- **Framework:** Next.js (App Router), detected automatically by Vercel.
- **Monorepo:** The Next app is **not** at the repository root. It lives in **`vigil/`** until you rename it ([`NAMING.md`](./NAMING.md)).
- **Build:** After install, Vercel runs **`npm run check`** (lint + production build) via [`vercel.json`](../vercel.json) — same gate as local CI. Local **`npm run build`** remains **`next build` only** for quick iteration.

## 2. Create the Vercel project

1. In [Vercel](https://vercel.com), **Add New… → Project** and import the **Git** repo that contains this tree.
2. Under **Configure Project**:
   - **Framework Preset:** Next.js (auto).
   - **Root Directory:** **`vigil`** → *Edit* → set to `vigil` (so Vercel runs install/build inside that folder).  
     If you already renamed the folder to `heartgarden`, use **`heartgarden`** instead and update path filters in [`.github/workflows/heartgarden-ci.yml`](../../.github/workflows/heartgarden-ci.yml) to match.
   - **Build Command:** leave **Override** empty so Vercel uses [`vercel.json`](../vercel.json) → **`npm run check`**. If you override in the dashboard, set it to **`npm run check`** to match (lint + `next build`).
   - **Install Command:** leave default (`npm install`) or use **`npm ci`** only if you enable a setting that skips lockfile issues; this repo ships `package-lock.json` under `vigil/`.
   - **Output Directory:** leave default (Next handles this).
3. **Node.js version:** In **Project → Settings → General → Node.js Version**, pick **22.x** (matches CI) or at least **20.x** (`package.json` has `"engines": { "node": ">=20" }`).

Deploy once **without** secrets if you only want to confirm the build; the app will run in **demo / local-only** mode until `NEON_DATABASE_URL` is set (see [`app/api/bootstrap/route.ts`](../app/api/bootstrap/route.ts)).

## 3. Environment variables

Add these in **Project → Settings → Environment Variables**. Mark secrets as **Sensitive** where offered.

| Variable | Environments | Required | Notes |
|----------|----------------|----------|--------|
| `NEON_DATABASE_URL` | Production, Preview (optional) | For cloud sync | Postgres URL from Neon. Prefer the **pooled / serverless** connection string Neon documents for **many short-lived connections** (fits Vercel functions). Include SSL if Neon gives it (`?sslmode=require` etc.). |
| `ANTHROPIC_API_KEY` | Production, Preview (optional) | For lore | Powers **`/api/lore/query`** and lore import extract. **Never** prefix with `NEXT_PUBLIC_`. |
| `ANTHROPIC_LORE_MODEL` | Same | Optional | Default in code if unset. |
| `OPENAI_API_KEY` | Production, Preview (optional) | For semantic search + embeddings | Enables chunk embeddings, hybrid / semantic [`/api/search`](../app/api/search/route.ts) and richer lore retrieval. Without it, search stays lexical-only. **Never** `NEXT_PUBLIC_`. |
| `HEARTGARDEN_EMBEDDING_MODEL` | Same | Optional | Default `text-embedding-3-small` in code if unset. |
| `R2_ACCOUNT_ID` | Production, Preview | For R2 uploads | With the other `R2_*` vars, enables [`/api/upload/presign`](../app/api/upload/presign/route.ts). |
| `R2_ACCESS_KEY_ID` | Same | For R2 | |
| `R2_SECRET_ACCESS_KEY` | Same | For R2 | Sensitive. |
| `R2_BUCKET_NAME` | Same | For R2 | |
| `R2_PUBLIC_BASE_URL` | Same | For R2 | Public origin for GET of uploaded objects, **no trailing slash** (e.g. `https://pub-xxxx.r2.dev`). |

**Do not set on Vercel:**

- `PLAYWRIGHT_E2E` — would force empty bootstrap (tests only).
- `NEXT_PUBLIC_*` for database or Anthropic keys — not used for those; keep server secrets server-only.

**MCP-only (local `npm run mcp`, not the web deploy):** `HEARTGARDEN_APP_URL`, `HEARTGARDEN_DEFAULT_SPACE_ID`, `HEARTGARDEN_MCP_WRITE_KEY` — optional on Vercel for the running site; set them on the machine where you run the MCP process if you point it at production.

### Preview vs Production

- **Recommended (isolated previews):** Create a **separate Neon branch / database** for **Preview**; set **only** that pooled URL on the **Preview** environment in Vercel. Run `db:ensure-pgvector` and schema push/migrate against that branch too. Production and Preview stay independent (no PR tests touching prod data).
- **Simplest (not recommended for active development):** Use the same `NEON_DATABASE_URL` on **Preview** as Production — easy, but destructive or noisy tests can affect shared data.
- **Lore / R2:** Omit Anthropic, OpenAI, and R2 on Preview if you want cheaper/safer PR previews (canvas still works in demo/local-style modes depending on what’s set).

After changing env vars, **redeploy** (Deployments → … → Redeploy) so new values apply.

## 4. Database (Neon) before or after first deploy

From your laptop, with production URL in env (or pasted for one command):

1. Enable **`pgvector`** if your schema uses embeddings:  
   `npm run db:ensure-pgvector` from **`vigil/`** with `NEON_DATABASE_URL` pointing at that database.
2. Apply schema: **`npm run db:push`** or **`npm run db:migrate`** (whatever you use for this project — see [`docs/MIGRATION.md`](./MIGRATION.md) if upgrading).

Order matters: extensions and migrations run **against Neon**, not inside Vercel’s build step, unless you deliberately add a migration step to CI/CD.

## 5. Cloudflare R2 (optional)

If you use browser uploads:

1. Create bucket + S3 API token; fill all `R2_*` env vars on Vercel.
2. **CORS** on the bucket must allow the browser to **PUT** to the presigned URL from your **Vercel origin** (e.g. `https://your-project.vercel.app`) and optionally your custom domain. Allowed methods typically include **PUT**; allowed headers at least **`Content-Type`**. Without CORS, presign succeeds but the browser upload fails.

## 6. Custom domain

**Project → Settings → Domains:** add your domain; point DNS as Vercel instructs. TLS is automatic.

## 7. Security note (public URL)

Lore and several APIs are **unauthenticated** today. Before sharing a wide audience link, add rate limiting, auth, or edge protection — see [`FOLLOW_UP.md`](./FOLLOW_UP.md).

## 8. CLI workflow (optional)

On your machine:

```bash
cd vigil
npx vercel login
npx vercel link    # connect repo directory to the Vercel project
npx vercel env pull .env.local   # optional: pull non-production env for local parity
```

Production deploys are usually triggered by **git push** once the Git integration is connected.

## 9. Troubleshooting

| Symptom | Things to check |
|--------|-------------------|
| Build fails on Vercel | Root Directory **`vigil`**, Node **20+**, same branch as local; run **`npm run check`** locally from `vigil/`. If only lint fails, fix ESLint or align dashboard **Build Command** with **`npm run check`**. |
| Site loads but always “demo” / empty cloud | `NEON_DATABASE_URL` missing or wrong environment; redeploy after fixing. |
| DB errors / too many connections | Use Neon’s **pooled** connection string for serverless. |
| R2 upload fails in browser | CORS on bucket for your Vercel URL; `R2_PUBLIC_BASE_URL` matches how objects are read. |
| Lore always errors | `ANTHROPIC_API_KEY` set for **Production** (or Preview); check function logs in Vercel. |

## 10. Quick verification after deploy

1. Open production URL → app shell loads.
2. If Neon is configured: create or move an item, refresh — persistence should hold.
3. If Anthropic is configured: **Ask lore** from the command palette once.
4. Optional: hit **`GET /api/bootstrap`** — JSON should show `demo: false` when the DB is wired.

---

*See also:* [`NAMING.md`](./NAMING.md) (folder name vs product), [`FOLLOW_UP.md`](./FOLLOW_UP.md) (keys and human follow-ups).
