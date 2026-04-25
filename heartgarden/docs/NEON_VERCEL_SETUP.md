# Neon for Vercel (Production + Preview branches)

**Use this only for the database side of deploys**: Neon branches, pooled URLs, and schema setup. It is not the first deploy walkthrough.

**Need a different deploy doc?**

- **Start / deploy order:** [`DEPLOY_VERCEL.md`](./DEPLOY_VERCEL.md)
- **Dashboard clicks:** [`DEPLOY_VERCEL_CHECKLIST.md`](./DEPLOY_VERCEL_CHECKLIST.md)
- **Env variable meanings:** [`VERCEL_ENV_VARS.md`](./VERCEL_ENV_VARS.md)
- **Go-live follow-up:** [`GO_LIVE_REMAINING.md`](./GO_LIVE_REMAINING.md)

Schema and extensions apply **on Neon**, not inside Vercel’s build. Use this when following the deploy plan’s **separate Preview database** decision.

**Environment variable definitions** (what to paste into Vercel, boot PIN semantics, etc.) live only in **[`VERCEL_ENV_VARS.md`](./VERCEL_ENV_VARS.md)** — not duplicated here.

## 1. Production database

1. In [Neon](https://neon.tech), create a project (or use an existing one) for **production**.
2. Copy the **pooled** / **serverless** connection string (Neon documents this for serverless drivers — fits Vercel functions).
3. On your machine, from **`heartgarden/`**:

   ```bash
   set NEON_DATABASE_URL=postgresql://...   # Windows PowerShell: $env:NEON_DATABASE_URL="..."
   pnpm run db:ensure-pgvector
   pnpm run db:vault-setup
   ```

   Or, if you prefer interactive schema push without the vault bundle: **`pnpm run db:push`** after **`db:ensure-pgvector`** — see [`MIGRATION.md`](./MIGRATION.md) for upgrades.

4. Paste **`NEON_DATABASE_URL`** into Vercel → **Production** environment only (see [`DEPLOY_VERCEL_CHECKLIST.md`](./DEPLOY_VERCEL_CHECKLIST.md)).

## 2. Preview database (separate branch)

1. In the same Neon project, create a **branch** (e.g. `preview` or `vercel-preview`) — Neon treats branches as isolated databases.
2. Copy that branch’s **pooled** connection string.
3. From **`heartgarden/`**, point **`NEON_DATABASE_URL`** at the **Preview** branch URL and run the **same** commands as step 1 (`db:ensure-pgvector`, then `db:vault-setup` or equivalent). Preview must have **`pgvector`** and the same schema before PR apps can use embeddings/search safely.

4. In Vercel, add **`NEON_DATABASE_URL`** scoped to **Preview** only with the Preview branch URL. **Do not** reuse Production’s URL on Preview if you want isolation.

## 3. After every schema / migration change

**`pnpm run db:vault-setup`** replays **every** `.sql` file under **`drizzle/migrations/`** in lex order (each is idempotent). Run it against **every** target DB URL that should match the new code — local, Preview branch, Production — before redeploying code that depends on the new schema. Skipping Production is what causes **`/api/bootstrap`** to 500 with **`column … does not exist`**. The manual GitHub Actions workflow below is the hands‑off way to do this for a chosen URL.

## 4. GitHub Actions (optional)

To apply vault SQL from CI against a chosen database, use **`.github/workflows/heartgarden-db-vault.yml`** with secret **`HEARTGARDEN_NEON_DATABASE_URL`** — run separately for prod vs preview URLs if you automate both.

## 5. After deploy

- Vault reindex (optional): with the **deployed** app URL, run **`pnpm run vault:reindex`** locally with **`HEARTGARDEN_APP_URL`** set to your Vercel origin (see [`FOLLOW_UP.md`](./FOLLOW_UP.md)).
