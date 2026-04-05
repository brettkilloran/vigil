This is a [Next.js](https://nextjs.org) app: **heartgarden** — a custom DOM infinite canvas (no third-party whiteboard SDK).

## Product direction

Full spec: **`docs/HEARTGARDEN_MASTER_PLAN.md`**. Engineering bridge: **`docs/STRATEGY.md`**.

**Stack:** Next.js App Router, React, Tailwind CSS 4, buffered **contentEditable** notes, Drizzle + Neon, **d3-force** (graph overlay).

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without `NEON_DATABASE_URL`, the app runs in **local-only** mode (data in `localStorage`). With Neon configured, use **`docs/STRATEGY.md`** migration notes if upgrading from older schemas (removed `users` / `source_shape_id` / tldraw snapshots).

Copy [`.env.local.example`](.env.local.example) to `.env.local` for database, optional **Anthropic** (lore Q&A), optional **OpenAI** (vault embeddings / hybrid search), and optional R2.

Upgrading an old Neon schema: see [`docs/MIGRATION.md`](docs/MIGRATION.md).

**Neon + vault index (automated):** From this folder, **`npm run db:vault-setup`** runs pgvector, **`drizzle-kit push --force`**, and the vault SQL migration (see [`docs/FOLLOW_UP.md`](docs/FOLLOW_UP.md)). With the dev server running and **`OPENAI_API_KEY`** set for the app, **`npm run vault:reindex`** backfills chunk embeddings for all items. GitHub: manual workflow **`heartgarden-db-vault.yml`** + secret **`HEARTGARDEN_NEON_DATABASE_URL`**.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Development server (**runs until stopped** — not a stuck terminal) |
| `npm run dev:surfaces` | Run app (`:3000`) and Storybook (`:6006`) together for side-by-side validation |
| `npm run check` | `lint` + `build` (use this for quick verification; exits when done) |
| `npm run verify:foundation-sync` | Ensure app entry + foundation shell wiring did not drift from Storybook components |
| `npm run build` | Production build |
| `npm run db:push` | Push Drizzle schema to Neon (interactive) |
| `npm run db:push:force` | `drizzle-kit push --force` (CI / automation; review data-loss prompts before using on prod) |
| `npm run db:vault-sql` | Apply `drizzle/migrations/0003_vault_embeddings_lore_meta.sql` via `pg` (HNSW fallback if unsupported) |
| `npm run db:vault-setup` | **`db:ensure-pgvector`** → **`db:push:force`** → **`db:vault-sql`** |
| `npm run vault:reindex` | HTTP fan-out to **`POST /api/items/:id/index`** for every item (app must be up; see `.env.local.example` for `VAULT_REINDEX_*`) |
| `npm run mcp` | MCP stdio tools (legacy names **`vigil_*`**, e.g. **`vigil_list_items`**, **`vigil_search`**, **`vigil_graph`**) — needs app reachable at `HEARTGARDEN_APP_URL` (default `http://localhost:3000`). Do not rename tool strings without updating MCP client configs. |

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

That is usually **`next dev`** (or a second copy started by mistake). Stop it from the terminal trashcan / **Ctrl+C**, or run **`npm run check`** instead when you only need to validate the project.

### Storybook and app out of sync?

Run both surfaces together while editing foundation UI:

```bash
npm run dev:surfaces
```

Then keep these open in parallel:

- App: [http://127.0.0.1:3000](http://127.0.0.1:3000)
- Storybook: [http://127.0.0.1:6006](http://127.0.0.1:6006)

If one view looks stale:

1. Hard-refresh the stale tab (`Ctrl+Shift+R`).
2. Confirm the terminal shows a fresh compile for the file you changed.
3. Run `npm run verify:foundation-sync` to ensure the app still points at the same foundation components being edited in Storybook.

## Deploy on Vercel

**Short version:** Vercel **Root Directory** = **`vigil`**. Set `NEON_DATABASE_URL` (and optional Anthropic / R2 per [`.env.local.example`](.env.local.example)). Do **not** set `PLAYWRIGHT_E2E`. No tldraw license is required.

**Full checklist (Neon pooling, Preview envs, R2 CORS, CLI, troubleshooting):** **[`docs/DEPLOY_VERCEL.md`](docs/DEPLOY_VERCEL.md)**.

**Naming:** **`docs/NAMING.md`** (heartgarden vs `vigil/` folder, stable `vigil:*` IDs).
