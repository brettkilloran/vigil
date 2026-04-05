# heartgarden naming vs repo paths

**Product and package name:** **heartgarden** (UI metadata, `package.json`, Vercel project name, marketing).

**App directory in git:** **`vigil/`** (historical folder name). All commands (`npm install`, `npm run check`, Vercel **Root Directory**) use this path **until** you rename the folder.

## Stable technical identifiers (do not rename casually)

These stay as **`vigil…`** on purpose so existing data and integrations keep working:

- **TipTap / note links:** `vigil:item:<uuid>` (stored in `content_json` and Neon).
- **MCP tool names:** `vigil_list_items`, `vigil_search`, etc. (Cursor MCP configs reference them by string).
- **CSS design tokens:** `--vigil-*`, classes like `vigil-btn`, `data-vigil-theme` (large surface area).
- **localStorage keys:** e.g. `vigil-canvas-local-v1`, `vigil-recent-items`, `vigil-canvas-effects-enabled`.

Renaming those requires migrations, dual-read/write, or user data loss.

## Optional: rename the app folder to `heartgarden/`

When no editor or terminal has the folder open (Windows may otherwise return “in use”):

1. From the **repository root**: `git mv vigil heartgarden`
2. Update **`.github/workflows/heartgarden-ci.yml`**: replace `vigil` with `heartgarden` in `paths`, `working-directory`, and `cache-dependency-path`.
3. Update **Cursor rules** that use `globs: vigil/**` to `globs: heartgarden/**` (repo `.cursor/rules/` and `heartgarden/.cursor/rules/` after the move).
4. Search the repo for the string `vigil/` in docs and fix paths (this file, `README.md`, `AGENTS.md`, `docs/archive/README.md`, etc.).
5. In **Vercel**, set **Root Directory** to **`heartgarden`**.

Internal module/file names such as `VigilApp.tsx` or `vigil-ui-classes.ts` can stay; they are implementation detail.

## Deploying

Step-by-step Vercel setup (root directory, env tables, Neon/R2, previews): **`docs/DEPLOY_VERCEL.md`**.
