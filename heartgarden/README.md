This is a [Next.js](https://nextjs.org) app: **heartgarden** — a custom DOM infinite canvas (no third-party whiteboard SDK).

## Product direction

**Agent / contributor onboarding:** **`AGENTS.md`**. **Documentation index (links only):** **`docs/HEARTGARDEN_MASTER_PLAN.md`**. Engineering bridge: **`docs/STRATEGY.md`**.

**Stack:** Next.js App Router, React, Tailwind CSS 4, buffered **contentEditable** notes, Drizzle + Neon, **d3-force** (graph overlay).

## Getting started

```bash
pnpm install
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without `NEON_DATABASE_URL`, the app runs in **local-only** mode (data in `localStorage`). With Neon configured, use **`docs/STRATEGY.md`** migration notes if upgrading from older schemas (removed `users` / `source_shape_id` / tldraw snapshots).

Copy [`.env.local.example`](.env.local.example) to `.env.local` for database, optional **Anthropic** (lore Q&A, imports), optional **OpenAI** embeddings (vault vectors / semantic search), and optional R2.

Upgrading an old Neon schema: see [`docs/MIGRATION.md`](docs/MIGRATION.md).

**Neon + vault index (automated):** From this folder, **`pnpm run db:vault-setup`** runs pgvector, **`drizzle-kit push --force`**, and replays every file in **`drizzle/migrations/`** in order via **`db:vault-sql`** (idempotent; new `.sql` files get picked up automatically). See [`docs/FOLLOW_UP.md`](docs/FOLLOW_UP.md). When **`OPENAI_API_KEY`** is set, **`src/lib/embedding-provider.ts`** writes chunk vectors with OpenAI embeddings (default **`text-embedding-3-small`**); without it, vault reindex still refreshes lexical search data and lore meta, and hybrid/semantic modes fall back to lexical-only retrieval. GitHub: manual workflow **`heartgarden-db-vault.yml`** + secret **`HEARTGARDEN_NEON_DATABASE_URL`**.

## Scripts

| Script | Purpose |
|--------|---------|
| `pnpm run dev` | Development server (**runs until stopped** — not a stuck terminal) |
| `pnpm run dev:surfaces` | Run app (`:3000`) and Storybook (`:6006`) together for side-by-side validation |
| `pnpm run check` | `lint` + `build` (use this for quick verification; exits when done) |
| `pnpm run verify:foundation-sync` | Ensure app entry + foundation shell wiring did not drift from Storybook components |
| `pnpm run build` | Production build |
| `pnpm run db:push` | Push Drizzle schema to Neon (interactive) |
| `pnpm run db:push:force` | `drizzle-kit push --force` (CI / automation; review data-loss prompts before using on prod) |
| `pnpm run db:vault-sql` | Apply every `drizzle/migrations/*.sql` file in order via `pg` (idempotent — `IF NOT EXISTS` guards; HNSW fallback if unsupported). Applies extensions / custom indexes / backfills that `drizzle-kit push` cannot express. |
| `pnpm run db:vault-setup` | **`db:ensure-pgvector`** → **`db:push:force`** → **`db:vault-sql`** |
| `pnpm run vault:reindex` | HTTP fan-out to **`POST /api/items/:id/index`** for every item (app must be up; see `.env.local.example` for `VAULT_REINDEX_*`) |
| `pnpm run mcp` | MCP stdio tools (**`heartgarden_*`**, e.g. **`heartgarden_list_items`**, **`heartgarden_search`**, **`heartgarden_graph`**; legacy **`vigil_*`** aliases still work on call) — needs app reachable at `HEARTGARDEN_APP_URL` (default `http://localhost:3000`). Hosted Streamable HTTP: **`GET|POST|DELETE /api/mcp`** with **`Authorization: Bearer HEARTGARDEN_MCP_SERVICE_KEY`** (see **`AGENTS.md`**). |
| `pnpm run realtime` | Optional dedicated WebSocket room server for multiplayer invalidation fanout. Requires **`HEARTGARDEN_REALTIME_URL`**, **`HEARTGARDEN_REALTIME_REDIS_URL`**, and **`HEARTGARDEN_REALTIME_SECRET`**. Clients still merge from Neon via `/api/spaces/:id/changes`; realtime just wakes them immediately. |

**More pnpm tasks** (see also **`AGENTS.md`** for CI and Storybook guardrails):

| Script | Purpose |
|--------|---------|
| `pnpm run check:all` | `check` + production **Storybook** build (use when touching stories or `.storybook/`) |
| `pnpm run analyze` | Webpack bundle analyzer (`ANALYZE=1` build) |
| `pnpm run test:unit` | Vitest unit tests (`src/**/*.test.ts`) |
| `pnpm run test:e2e` | Playwright (`e2e/`); see **`AGENTS.md`** for **`PLAYWRIGHT_E2E`** / port **3001** |
| `pnpm run test:e2e:visual` | Visual regression snapshots (OS-specific baselines) |
| `pnpm run reinstall` | Clean reinstall **`node_modules`** from lockfile (fixes broken Storybook/Webpack installs) |
| `pnpm run verify:editor-cutover` | Guard script for editor migration wiring |
| `pnpm run mcp:smoke` | Smoke-test hosted **`/api/mcp`** (same transport as Claude Desktop) |
| `pnpm run realtime:redis-smoke` | Redis connectivity check for realtime stack |
| `pnpm run db:studio` | Drizzle Studio |
| `pnpm run db:migrate` | `drizzle-kit migrate` |
| `pnpm run db:sever-worlds` | One-time GM / Players data severance — see **`docs/PLAYER_LAYER.md`** |
| `pnpm run storybook:lan` | Storybook on **`0.0.0.0:6006`** (LAN) |
| `pnpm run storybook:doctor` | Preflight that Storybook deps exist |
| `pnpm run storybook:static` | Build + serve static Storybook on **6007** |
| `pnpm run secrets:protect` / `secrets:scan` | Gitleaks (repo root config) |

### Keyboard (canvas, not typing in a note)

Handlers use **`Ctrl` on Windows and Linux** and **`⌘` on macOS** (`ctrlKey || metaKey`). Toolbar labels match your OS after load.

| Keys | Action |
|------|--------|
| Arrows | Nudge selected item (Shift = larger step) |
| **Alt+Shift** + arrows | Spatial jump: select nearest item in that direction (from selection or viewport center); recenters camera on the target |
| **Ctrl+K** (Win/Linux) or **⌘K** (Mac) | Command palette |
| **Ctrl+Z** / **Ctrl+Shift+Z** (Win/Linux) or **⌘Z** / **⇧⌘Z** (Mac) | Undo / redo |
| **Ctrl+S** (Win/Linux) or **⌘S** (Mac) | Stack selection |

**Phase 5 (TTRPG):** With a **note** selected, use the **TTRPG** bar to set entity type and optional metadata (e.g. Event + date for **Timeline**). Toolbar **Timeline** lists event-tagged notes; **Graph** (cloud) lays out items and `item_links` with **d3-force** (link + charge + collision).

### “Background shell” running 20+ minutes?

That is usually **`next dev`** (or a second copy started by mistake). Stop it from the terminal trashcan / **Ctrl+C**, or run **`pnpm run check`** instead when you only need to validate the project.

### Storybook and app out of sync?

Run both surfaces together while editing foundation UI:

```bash
pnpm run dev:surfaces
```

Then keep these open in parallel:

- App: [http://127.0.0.1:3000](http://127.0.0.1:3000)
- Storybook: [http://127.0.0.1:6006](http://127.0.0.1:6006)

If one view looks stale:

1. Hard-refresh the stale tab (`Ctrl+Shift+R`).
2. Confirm the terminal shows a fresh compile for the file you changed.
3. Run `pnpm run verify:foundation-sync` to ensure the app still points at the same foundation components being edited in Storybook.

## Deploy on Vercel

**Short version:** Vercel **Root Directory** = **`heartgarden`**. Set `NEON_DATABASE_URL` (and optional Anthropic / R2 per [`.env.local.example`](.env.local.example)). Do **not** set `PLAYWRIGHT_E2E`. No tldraw license is required.

**Build error *Root Directory `vigil` does not exist*:** the dashboard still points at the old folder name — set **Root Directory** to **`heartgarden`** and redeploy ([`docs/DEPLOY_VERCEL.md`](docs/DEPLOY_VERCEL.md) § “Root Directory must be `heartgarden`”).

**Full guide:** **[`docs/DEPLOY_VERCEL.md`](docs/DEPLOY_VERCEL.md)**. **Dashboard checklist:** **[`docs/DEPLOY_VERCEL_CHECKLIST.md`](docs/DEPLOY_VERCEL_CHECKLIST.md)**. **Neon prod + Preview branches:** **[`docs/NEON_VERCEL_SETUP.md`](docs/NEON_VERCEL_SETUP.md)**.

**Naming:** **`docs/NAMING.md`** (product name, app path **`heartgarden/`**, stable **`vigil:*`** data where applicable).
