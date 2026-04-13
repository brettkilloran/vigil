# Go-live: what’s left + prompts for the assistant

Use this after the initial Vercel project work. It lists **only what you must do** (accounts, secrets, DNS), then **copy-paste prompts** you can send to Cursor so the assistant can verify, deploy, and debug **without** needing your Neon/Vercel passwords.

**Related:** [`DEPLOY_VERCEL_CHECKLIST.md`](./DEPLOY_VERCEL_CHECKLIST.md) (full dashboard list), [`DEPLOY_VERCEL.md`](./DEPLOY_VERCEL.md), [`NEON_VERCEL_SETUP.md`](./NEON_VERCEL_SETUP.md), [`VERCEL_ENV_VARS.md`](./VERCEL_ENV_VARS.md).

---

## Already in good shape (FYI)

These were aligned earlier; you normally **do not** redo them unless something broke:

- Vercel project **heartgarden**: **Root Directory** **`heartgarden`**, **Next.js**, **Node 22.x**, monorepo GitHub (your repo), production branch **`main`**.
- [`vercel.json`](../vercel.json) uses **`framework: nextjs`** and **`npm run check`**.
- **Do not** set **`PLAYWRIGHT_E2E`** on Vercel.

**CLI habit:** link and deploy from the **monorepo root** (`Cursor/`), not from `heartgarden/` alone, so paths stay consistent with **Root Directory `heartgarden`**. See root `.vercel` / `.gitignore`.

---

## Phase 1 — Neon production + schema (you)

1. In [Neon](https://neon.tech), create or pick a **production** project/branch.
2. Copy the **pooled / serverless** Postgres URL (Neon’s recommendation for serverless clients).
3. On your PC, from **`heartgarden/`**, with that URL in the environment:

   ```powershell
   $env:NEON_DATABASE_URL = "postgresql://..."   # your pooled URL
   npm run db:ensure-pgvector
   npm run db:vault-setup
   ```

   (Alternatives: `db:push` after `db:ensure-pgvector` — see [`MIGRATION.md`](./MIGRATION.md).)

4. In **Vercel → Project → Settings → Environment Variables**, add **`NEON_DATABASE_URL`** for **Production** only (mark **Sensitive**). **Redeploy** production (Deployments → … → Redeploy) so the new value is picked up.

**Security:** Prefer pasting secrets in the **Vercel UI** yourself instead of into chat.

---

## Phase 2 — Verify production (assistant)

**Prompt to send:**

> I added `NEON_DATABASE_URL` to Vercel Production and redeployed. Please verify: run or guide `vercel curl /api/bootstrap` from the linked monorepo root and confirm `demo` is false; if anything fails, inspect the latest deployment logs and fix config or code.

---

## Phase 3 — Optional: lore (you + assistant)

**You (Vercel Production, sensitive):**

- `ANTHROPIC_API_KEY` — lore Q&A / import extract.
- Optionally `ANTHROPIC_LORE_MODEL`.
- If the site is public and lore should stay off: `HEARTGARDEN_LORE_QUERY_DISABLED=1` (see [`DEPLOY_VERCEL.md`](./DEPLOY_VERCEL.md) §7).

Redeploy after changes.

**Prompt to send:**

> Production env now has [list which: Anthropic / lore disabled]. Please confirm `/api/bootstrap`, smoke `/api/lore/query` or confirm 503 if disabled, and note anything missing from [`VERCEL_ENV_VARS.md`](./VERCEL_ENV_VARS.md).

---

## Phase 4 — Optional: Preview DB + Vercel Preview (you)

Follow [`NEON_VERCEL_SETUP.md`](./NEON_VERCEL_SETUP.md) §2: Neon **preview branch**, same CLI setup against that URL, then **`NEON_DATABASE_URL`** on Vercel scoped to **Preview** only.

**Prompt to send:**
NEON_VERCEL_SETUP.md
> I set Preview `NEON_DATABASE_URL` and ran pgvector + schema on the preview branch. Please confirm a Preview deployment can bootstrap (describe how to test with deployment protection if needed).

---

## Phase 5 — Optional: R2 uploads (you)

1. Create bucket + S3 API token in Cloudflare R2.
2. Set all **`R2_*`** vars on Vercel for the right environments ([`VERCEL_ENV_VARS.md`](./VERCEL_ENV_VARS.md)).
3. **CORS** on the bucket: allow your **`https://heartgarden.vercel.app`** (and preview origins if needed) — JSON example in [`DEPLOY_VERCEL.md`](./DEPLOY_VERCEL.md) §5.

**Prompt to send:**

> R2 env vars and CORS are configured. Please help me smoke-test upload from the app and presign URL behavior; if it fails, narrow whether it’s CORS, env, or API.

---

## Phase 6 — Optional: custom domain (you)

**Vercel → Settings → Domains** → add domain → complete DNS as shown.

**Prompt to send:**

> Custom domain is connected. Please confirm redirects/HTTPS expectations and anything in the repo that should use the new canonical URL.

---

## Phase 7 — Before wide sharing (you)

- **Vercel Deployment Protection:** keep or relax Preview/Production per your audience ([`DEPLOY_VERCEL.md`](./DEPLOY_VERCEL.md) §7).
- **Anthropic:** billing alerts and spend caps in **their** dashboard.
- Lore: keep **`HEARTGARDEN_LORE_QUERY_DISABLED=1`** until you trust access control and rate limits.

**Prompt to send:**

> I’m about to share the URL publicly. Review [`DEPLOY_VERCEL.md`](./DEPLOY_VERCEL.md) §7 against my current Vercel env and suggest any last env toggles.

---

## Phase 8 — Optional: vault reindex (assistant + you)

You may run **`npm run vault:reindex`** locally with **`HEARTGARDEN_APP_URL`** pointing at production — see [`NEON_VERCEL_SETUP.md`](./NEON_VERCEL_SETUP.md) §4 and [`FOLLOW_UP.md`](./FOLLOW_UP.md). Vector chunk rows require a future embedding provider in **`src/lib/embedding-provider.ts`**.

**Prompt to send:**

> Production is live. Walk me through `vault:reindex` safely and what to verify after.

---

## “Live and complete” — definition

Use this as your done criteria:

| Gate | Check |
|------|--------|
| Production deploy | Latest deployment **Ready**; app shell loads (respecting deployment protection if enabled). |
| Database | **`GET /api/bootstrap`** returns **`demo: false`** and sensible spaces/items when you have data. |
| Lore (if you use it) | **Ask lore** works **or** **`HEARTGARDEN_LORE_QUERY_DISABLED=1`** and you accept 503 on query until hardened. |
| Preview (if you use it) | Preview env has its own **`NEON_DATABASE_URL`**; PR apps don’t point at prod DB. |
| R2 (if you use it) | Upload completes; object reachable via **`R2_PUBLIC_BASE_URL`**. |
| Going public | Protection + provider billing + lore toggle match your risk tolerance. |

**Final prompt when you think you’re done:**

> Run a full go-live audit against `heartgarden/docs/GO_LIVE_REMAINING.md` “Live and complete” table: check bootstrap, optional lore/R2/preview, and call out any gaps.

---

## If something breaks — generic prompts

- **Build failed on Vercel:**  
  > Latest Vercel build failed for heartgarden. Here’s the build log excerpt: [paste]. Fix what’s needed in the repo or tell me the exact dashboard change.

- **404 / wrong app:**  
  > Production URL returns 404 or wrong site. Verify Vercel Root Directory `heartgarden`, framework Next.js, and [`vercel.json`](../vercel.json); suggest `vercel deploy` from monorepo root if needed.

- **Bootstrap still `demo: true`:**  
  > `NEON_DATABASE_URL` is set but bootstrap is still demo. Help trace env visibility on Vercel and server-side bootstrap code.

---

*Last aligned with repo layout: monorepo root contains `heartgarden/`; Vercel **Root Directory** is **`heartgarden`**.*
