# Deploy heartgarden on Vercel

This is the **step-by-step** companion to the short notes in [`README.md`](../README.md). I can’t log into your Vercel or Neon accounts from here; use this as a checklist while you click through the dashboards (or run the Vercel CLI on your machine after `vercel login`).

**Env variable meanings and edge cases** are defined only in **[`docs/VERCEL_ENV_VARS.md`](./VERCEL_ENV_VARS.md)**. The tables in §3 below are a deploy-oriented summary; if anything disagrees, **`VERCEL_ENV_VARS.md`** wins.

## 1. What you’re deploying

- **Framework:** Next.js (App Router), detected automatically by Vercel.
- **Monorepo:** The Next app is **not** at the repository root. It lives in **`heartgarden/`** ([`NAMING.md`](./NAMING.md)).
- **Build:** After install, Vercel runs **`npm run check`** (lint + production build) via [`vercel.json`](../vercel.json) — same gate as local CI. Local **`npm run build`** remains **`next build` only** for quick iteration.

## 2. Create the Vercel project

1. In [Vercel](https://vercel.com), **Add New… → Project** and import the **Git** repo that contains this tree.
2. Under **Configure Project**:
   - **Framework Preset:** Next.js (auto).
   - **Root Directory:** **`heartgarden`** → *Edit* → set to **`heartgarden`** (so Vercel runs install/build inside that folder).
   - **Build Command:** leave **Override** empty so Vercel uses [`vercel.json`](../vercel.json) → **`npm run check`**. If you override in the dashboard, set it to **`npm run check`** to match (lint + `next build`).
   - **Install Command:** leave default (`npm install`) or use **`npm ci`** only if you enable a setting that skips lockfile issues; this repo ships `package-lock.json` under `heartgarden/`.
   - **Output Directory:** leave default (Next handles this).
3. **Node.js version:** In **Project → Settings → General → Node.js Version**, pick **22.x** (matches CI) or at least **20.x** (`package.json` has `"engines": { "node": ">=20" }`).

Deploy once **without** secrets if you only want to confirm the build; the app will run in **demo / local-only** mode until `NEON_DATABASE_URL` is set (see [`app/api/bootstrap/route.ts`](../app/api/bootstrap/route.ts)).

## 3. Environment variables

**Authoritative matrix (definitions and edge cases):** [`docs/VERCEL_ENV_VARS.md`](./VERCEL_ENV_VARS.md). The table below is a deploy-oriented summary — if anything disagrees, **`VERCEL_ENV_VARS.md`** wins.

Add these in **Project → Settings → Environment Variables**. Mark secrets as **Sensitive** where offered.

| Variable | Environments | Required | Notes |
|----------|----------------|----------|--------|
| `NEON_DATABASE_URL` | Production, Preview (optional) | For cloud sync | Postgres URL from Neon. Prefer the **pooled / serverless** connection string Neon documents for **many short-lived connections** (fits Vercel functions). Include SSL if Neon gives it (`?sslmode=require` etc.). |
| `ANTHROPIC_API_KEY` | Production, Preview (optional) | For lore | Powers **`/api/lore/query`** and lore import extract. **Never** prefix with `NEXT_PUBLIC_`. |
| `ANTHROPIC_LORE_MODEL` | Same | Optional | Default in code if unset. |
| `R2_ACCOUNT_ID` | Production, Preview | For R2 uploads | With the other `R2_*` vars, enables [`/api/upload/presign`](../app/api/upload/presign/route.ts). |
| `R2_ACCESS_KEY_ID` | Same | For R2 | |
| `R2_SECRET_ACCESS_KEY` | Same | For R2 | Sensitive. |
| `R2_BUCKET_NAME` | Same | For R2 | |
| `R2_PUBLIC_BASE_URL` | Same | For R2 | Public origin for GET of uploaded objects, **no trailing slash** (e.g. `https://pub-xxxx.r2.dev`). |
| `HEARTGARDEN_LORE_QUERY_DISABLED` | Production, Preview (optional) | Hardening | Set to **`1`** to disable **`POST /api/lore/query`** (**503**) while the rest of the app stays up. Remove when auth / stronger limits are in place. |
| `HEARTGARDEN_BOOT_PIN_BISHOP` | Production, Preview (optional) | Boot gate | Exactly **8** characters if set; GM tier (`access`) in signed **`hg_boot`**. With **`HEARTGARDEN_BOOT_SESSION_SECRET`** (16+ chars), the gate turns on when **this and/or** Players / demo PIN is 8 chars. Sensitive. |
| `HEARTGARDEN_BOOT_PIN_PLAYERS` | Same | Players tier PIN | Exactly **8** characters if set; **`player`** tier in signed **`hg_boot`**. **`HEARTGARDEN_PLAYER_SPACE_ID`** is **optional** — if unset, the server uses an implicit dedicated Players root (see **`docs/PLAYER_LAYER.md`** and **`docs/VERCEL_ENV_VARS.md`**). Sensitive. |
| `HEARTGARDEN_BOOT_PIN_DEMO` | Same | Demo tier PIN | Exactly **8** characters if set; **`demo`** tier (local-seeded canvas). Sensitive. |
| `HEARTGARDEN_BOOT_SESSION_SECRET` | Same | Required if gate on | HMAC secret for boot session cookie. Sensitive. |
| `HEARTGARDEN_BOOT_SESSION_MAX_AGE_SEC` | Same | Optional | Cookie TTL (**60–31536000** seconds); default **30 days**. |
| `HEARTGARDEN_REALTIME_URL` | Production, Preview (optional) | Multiplayer realtime | **`wss://`** origin of the realtime server (see §5.5). Requires **`HEARTGARDEN_REALTIME_REDIS_URL`** and **`HEARTGARDEN_REALTIME_SECRET`**. |
| `HEARTGARDEN_REALTIME_REDIS_URL` | Same | Realtime | Redis pub/sub URL; same value on Vercel and the **`npm run realtime`** host. |
| `HEARTGARDEN_REALTIME_SECRET` | Same | Realtime | **≥ 16** characters; shared with the realtime server. |

**Do not set on Vercel:**

- `PLAYWRIGHT_E2E` — would force empty bootstrap (tests only) and disables the boot PIN gate in **`/api/heartgarden/boot`**.
- `NEXT_PUBLIC_*` for database or Anthropic keys — not used for those; keep server secrets server-only.

**MCP:** Set **`HEARTGARDEN_MCP_SERVICE_KEY`** on the **Vercel** deployment if you use **`GET|POST|DELETE /api/mcp`** (hosted Streamable HTTP) or need stdio **`npm run mcp`** to call **`fetch`** into production with the boot gate on. Optional on the laptop: **`HEARTGARDEN_APP_URL`**, **`HEARTGARDEN_DEFAULT_SPACE_ID`**, **`HEARTGARDEN_MCP_WRITE_KEY`** when running the stdio MCP client against production.

**Debugging `/api/mcp` in production:** In **Vercel → Project → Logs**, filter by path **`/api/mcp`** (or search `mcp`). Expect **401** when the service key is missing or wrong, **503** when **`HEARTGARDEN_MCP_SERVICE_KEY`** is unset in that environment, and **200** for successful MCP **`POST`**s. Do not paste tokens into tickets; use **`npm run mcp:smoke`** from **`heartgarden/`** with a local env var to verify end-to-end (see **`docs/API.md`** § MCP).

### MCP and Vercel Deployment Protection (SSO / auth wall)

**Symptom:** Remote MCP (Claude Desktop, **`mcp:smoke`**) fails or never reaches your app; responses mention **Vercel login**, **SSO**, or **`x-vercel-protection-bypass`**.

**Cause:** **Deployment Protection** (Vercel Authentication, password protection, etc.) runs **at Vercel’s edge**, before your Next.js route. Anthropic’s MCP broker **cannot** complete a browser SSO flow. **Heartgarden never runs** — this is not a Heartgarden `401` / boot gate issue.

**Recommended fix (production MCP):** In **Vercel → Project → Settings → Deployment Protection**, scope protection so **Production** is **publicly reachable** (many teams protect **Preview** only). Remote MCP **requires** a URL that **does not** show Vercel’s login page to unauthenticated server-to-server traffic.

**Optional workaround (not ideal):** Vercel supports **Protection Bypass for Automation** (see [Protection bypass for automation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation)). You can pass the bypass secret as a **query parameter** on the same URL as MCP (Claude does not let you set arbitrary headers). Append **`&x-vercel-protection-bypass=<secret>`** after **`?token=…`** and **percent-encode** the value if needed. **Treat this as a second secret** (leaks in logs like any query string). Prefer fixing Deployment Protection on Production instead.

**Preview URLs:** Deployments like **`*-git-*-*.vercel.app`** are often protected by default. Use the **production** hostname for the MCP connector unless you intentionally test protected previews.

### Preview vs Production

- **Recommended (isolated previews):** Create a **separate Neon branch / database** for **Preview**; set **only** that pooled URL on the **Preview** environment in Vercel. Run `db:ensure-pgvector` and schema push/migrate against that branch too. Production and Preview stay independent (no PR tests touching prod data).
- **Simplest (not recommended for active development):** Use the same `NEON_DATABASE_URL` on **Preview** as Production — easy, but destructive or noisy tests can affect shared data.
- **Lore / R2:** Omit Anthropic and R2 on Preview if you want cheaper/safer PR previews (canvas still works in demo/local-style modes depending on what’s set).

After changing env vars, **redeploy** (Deployments → … → Redeploy) so new values apply.

## 4. Database (Neon) before or after first deploy

From your laptop, with production URL in env (or pasted for one command):

1. Enable **`pgvector`** if your schema uses embeddings:  
   `npm run db:ensure-pgvector` from **`heartgarden/`** with `NEON_DATABASE_URL` pointing at that database.
2. Apply schema: **`npm run db:push`** or **`npm run db:migrate`** (whatever you use for this project — see [`docs/MIGRATION.md`](./MIGRATION.md) if upgrading).

Order matters: extensions and migrations run **against Neon**, not inside Vercel’s build step, unless you deliberately add a migration step to CI/CD.

## 5. Cloudflare R2 (optional)

If you use browser uploads:

1. Create bucket + S3 API token; fill all `R2_*` env vars on Vercel.
2. **CORS** on the bucket must allow the browser to **PUT** to the presigned URL from your **Vercel origin** (e.g. `https://your-project.vercel.app`) and optionally your custom domain. Allowed methods typically include **PUT**; allowed headers at least **`Content-Type`**. Without CORS, presign succeeds but the browser upload fails.

### Example CORS rule (R2 dashboard)

In **R2 → your bucket → Settings → CORS policy**, JSON like the following (replace origins with your real **`https://<project>.vercel.app`** and any custom domain). Wildcard `*.vercel.app` is **not** always accepted by every S3-compatible UI — if the editor rejects `*`, list each origin explicitly.

```json
[
  {
    "AllowedOrigins": [
      "https://heartgarden.vercel.app",
      "https://your-preview-branch.vercel.app"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type", "Content-Length"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Add a second origin line for every **stable** preview URL you care about, or tighten to Production only until you need previews uploading.

**Checklist:** [`DEPLOY_VERCEL_CHECKLIST.md`](./DEPLOY_VERCEL_CHECKLIST.md) section D references Preview DB; align **CORS** with the same hostnames you use in the browser.

### 5.5 Optional: multiplayer realtime (WebSocket + Redis)

Without this, the canvas still syncs via **polling** (`GET /api/spaces/[id]/changes`). Turning realtime **on** makes remote edits **wake** peers immediately; **Neon remains the source of truth**.

**What you need**

1. **Redis** reachable from both **Vercel** (serverless publishes after writes) and the **realtime** process (subscribes and fans out). **Upstash** (or any Redis with `SUBSCRIBE`) works; use the **same** URL in both places.
2. **A long-lived WebSocket server** — Vercel runs **`npm run check`** for the Next app only; **`npm run realtime`** must run **elsewhere** (container, VM, Fly.io, Railway, etc.).
3. **TLS in front of the socket server** so browsers can use **`wss://`** (required when the app is served over **https://**).

**Steps**

1. Create Redis; copy the connection URL (often `rediss://…` with TLS).
2. Generate a random string (**≥ 16** characters) for **`HEARTGARDEN_REALTIME_SECRET`** (same value everywhere).
3. Deploy **`npm run realtime`** from **`heartgarden/`** with env:
   - **`HEARTGARDEN_REALTIME_REDIS_URL`** — same as Vercel.
   - **`HEARTGARDEN_REALTIME_SECRET`** — same as Vercel.
   - **`HEARTGARDEN_REALTIME_PORT`** — optional (default **3002**); map the platform’s HTTP port to this process.
4. Put a **reverse proxy** or platform TLS in front so the public URL is **`wss://your-realtime-host/…`** (no path; the server upgrades `GET /` to WebSocket). **Caddy**, **nginx**, or the platform’s **HTTPS** service is typical.
5. On **Vercel** (Production, and Preview if you want previews to use realtime), set:
   - **`HEARTGARDEN_REALTIME_REDIS_URL`**
   - **`HEARTGARDEN_REALTIME_SECRET`**
   - **`HEARTGARDEN_REALTIME_URL`** — the **exact** **`wss://`** origin clients use (see [`VERCEL_ENV_VARS.md`](./VERCEL_ENV_VARS.md)).

6. **Redeploy** the Vercel project so serverless picks up the new env.

**Smoke:** `GET https://<realtime-host>/healthz` → `{"ok":true}` (if exposed). In the app, two browsers in the same space should see edits propagate without waiting for the poll interval.

**Container:** [`Dockerfile.realtime`](../Dockerfile.realtime) is an optional single-image build for the WebSocket process.

## 6. Custom domain

**Project → Settings → Domains:** add your domain; point DNS as Vercel instructs. TLS is automatic.

## 7. Security note (public URL)

Lore and several APIs are **unauthenticated** today. Before sharing a wide audience link:

| Measure | Notes |
|--------|--------|
| **Vercel Deployment Protection** | Password or SSO on **Preview** (and optionally Production) so random visitors cannot load the app — [Vercel docs](https://vercel.com/docs/security/deployment-protection). |
| **Disable lore until hardened** | Set **`HEARTGARDEN_LORE_QUERY_DISABLED=1`** on the server → **`POST /api/lore/query`** returns **503** (“Lore query disabled”). Canvas and other features keep working if the DB is configured. Remove or unset when you add proper auth / limits. |
| **Rate limits / KV** | In-process limits exist for lore query; for **global** limits use Redis or **Vercel KV** — see [`BUILD_PLAN.md`](./BUILD_PLAN.md) and [`FOLLOW_UP.md`](./FOLLOW_UP.md). |
| **API spend caps** | Use provider dashboards (Anthropic, etc.) for billing alerts and caps. |

Env var (optional, Production / Preview):

| Variable | Value | Effect |
|----------|--------|--------|
| `HEARTGARDEN_LORE_QUERY_DISABLED` | `1` | Blocks **`/api/lore/query`** only. |

## 8. CLI workflow (optional)

On your machine:

```bash
cd heartgarden
npx vercel login
npx vercel link    # connect repo directory to the Vercel project
npx vercel env pull .env.local   # optional: pull non-production env for local parity
```

Production deploys are usually triggered by **git push** once the Git integration is connected.

## 9. Troubleshooting

| Symptom | Things to check |
|--------|-------------------|
| Build fails on Vercel | Root Directory **`heartgarden`**, Node **20+**, same branch as local; run **`npm run check`** locally from `heartgarden/`. If only lint fails, fix ESLint or align dashboard **Build Command** with **`npm run check`**. |
| Site loads but always “demo” / empty cloud | `NEON_DATABASE_URL` missing or wrong environment; redeploy after fixing. |
| DB errors / too many connections | Use Neon’s **pooled** connection string for serverless. |
| R2 upload fails in browser | CORS on bucket for your Vercel URL; `R2_PUBLIC_BASE_URL` matches how objects are read. |
| Lore always errors | `ANTHROPIC_API_KEY` set for **Production** (or Preview); check function logs in Vercel. |
| Realtime never connects (falls back to poll) | **`HEARTGARDEN_REALTIME_*`** set on Vercel and **redeployed**; **`npm run realtime`** running with same Redis + secret; **`HEARTGARDEN_REALTIME_URL`** is **`wss://`** from the browser’s perspective; mixed-content blocks **`ws://`** on **https://** pages. |

## 10. Quick verification after deploy

1. Open production URL → app shell loads.
2. If Neon is configured: create or move an item, refresh — persistence should hold.
3. If Anthropic is configured: **Ask lore** from the command palette once.
4. Optional: hit **`GET /api/bootstrap`** — JSON should show `demo: false` when the DB is wired.

---

*See also:* [`DEPLOY_VERCEL_CHECKLIST.md`](./DEPLOY_VERCEL_CHECKLIST.md) (ordered dashboard tasks), [`NEON_VERCEL_SETUP.md`](./NEON_VERCEL_SETUP.md) (prod + Preview branches), [`NAMING.md`](./NAMING.md) (folder name vs product), [`FOLLOW_UP.md`](./FOLLOW_UP.md) (keys and human follow-ups).
