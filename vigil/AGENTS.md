<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# heartgarden — agent notes

## Naming (product vs `vigil/` folder)

**heartgarden** is the app name. The Next.js tree is in **`vigil/`** (legacy directory name). **Vercel** and **CI** use that path until you rename it — steps and stable `vigil:*` IDs (links, MCP tools, CSS tokens, localStorage) are documented in **`docs/NAMING.md`**.

## Source of truth

- **Lore-engine task order (Phases A–D, UX2):** Cursor plan `heartgarden_lore_engine_7fc1fb56.plan.md` under `.cursor/plans/` (YAML todos + narrative).
- **Product vs repo folder / rename checklist:** `docs/NAMING.md`
- **Repo-wide shipped vs next + hardening backlog:** `docs/BUILD_PLAN.md`
- **Doc index:** `docs/HEARTGARDEN_MASTER_PLAN.md`
- **Historical product bible (dated paths):** `docs/archive/vigil-master-plan-legacy.md` — `docs/VIGIL_MASTER_PLAN.md` is a stub pointer.
- **How the repo should move from here:** `docs/STRATEGY.md`
- **Blocked / account / infra follow-ups:** `docs/FOLLOW_UP.md`

Read **STRATEGY** for the current-vs-target delta, **BUILD_PLAN** for architecture and backlog, and the **Cursor plan** for ordered lore/import/MCP work. The legacy master plan still describes **custom DOM canvas** (no tldraw), **no auth**, **MIT stack**, and phases **1–8** at a product level.

## Current code reality

The **production shell** is **`ArchitecturalCanvasApp`** (`src/components/foundation/ArchitecturalCanvasApp.tsx`), mounted from `app/_components/VigilApp.tsx` (file name is legacy; this is the heartgarden shell). It uses **in-component graph state** (single source of truth for the canvas graph) + Neon sync (`architectural-db-bridge.ts`, `architectural-neon-api.ts`, `/api/bootstrap`, item/space APIs) when not in demo seed mode.

Persistence: **`items`** rows + **`spaces.canvas_state`** as camera `{ x, y, zoom }` only. **Links:** wiki-style `vigil:item:` targets in note HTML are resolved in the shell (e.g. **`ArchitecturalLinksPanel`**); cloud mode uses `/api/items/[id]/links` and Neon `item_links`. Shared row types: **`src/model/canvas-types.ts`** (API / mapper shape), separate from **`architectural-types.ts`** (in-memory graph).

**Lore v1:** Cmd+K → **Ask lore (AI)** → `LoreAskPanel` → **`POST /api/lore/query`** (FTS retrieval + Anthropic). **Search:** Postgres full-text + trigram; **`ANTHROPIC_API_KEY`** is for lore only (no separate embedding vendor).

**Neon sync strip:** Top status bar shows **Loading / Local / Saving / Saved / Sync error** via `neon-sync-bus.ts` + instrumented `architectural-neon-api.ts`. **Undo/redo** is in-memory only; tooltips spell out that the server keeps the **last successful write** until the next PATCH.

**Theme:** `useVigilTheme` sets `data-vigil-theme` when the user picks light/dark, and toggles **`class="dark"` on `<html>`** whenever the **resolved** appearance is dark (including “Match OS”). Tailwind `dark:*` is overridden in `app/globals.css` (`@custom-variant dark`) to follow that class—not only `prefers-color-scheme`—so chips, glass panels, and hovers match CSS variables.

## Local dev, Node, and Storybook (guardrails)

**Package manager:** Use **npm** only in the app directory (**`vigil/`** today — see **`docs/NAMING.md`** if renamed) (`package-lock.json`). Do not mix pnpm/yarn in the same tree without a deliberate migration.

**Node on PATH (Windows portable installs):** If `npm`/`node` are missing in a new terminal or in Cursor, the portable Node folder is probably not on **User** `PATH`.

**First-time setup or after upgrading Node portable:**

1. Download **Windows x64 Binary (.zip)** from [Node.js downloads](https://nodejs.org/en/download/) (pick the version you want).
2. Extract the zip so you have a folder like  
   `%LOCALAPPDATA%\node-portable\node-v24.x.x-win-x64`  
   (sibling to any older `node-v*-win-x64` folders is fine).
3. From the `vigil/` folder, run:
   - `powershell -ExecutionPolicy Bypass -File scripts/pin-portable-node-user-path.ps1`
4. **Restart Cursor** (or close all integrated terminals and open a new one) so they read the updated User `PATH`.

The script picks the **newest** `node-v*-win-x64` under `%LOCALAPPDATA%\node-portable\`, points `%LOCALAPPDATA%\node-portable\current` at it (junction), and prepends `current` to your **User** `PATH` — so the next upgrade is always: **unzip new version → run script again → restart Cursor**.

**Daily dev URLs:** From `vigil/`, prefer **`npm run dev:surfaces`** (app + Storybook). Use a normal browser (**Chrome / Edge**), not the editor’s embedded browser, for Storybook.

| Surface | URL | Notes |
|--------|-----|--------|
| heartgarden (Next) | `http://localhost:3000` | `next.config.ts` **`allowedDevOrigins`** includes `localhost` and `127.0.0.1` so dev HMR is not blocked when mixing those hosts. If you use the **Network** URL from the dev banner, add that **hostname** to `allowedDevOrigins` too. |
| Storybook (dev) | `http://localhost:6006` | Scripts use **`--host 0.0.0.0`** and `.storybook/main.ts` sets **`webpackFinal` → `devServer.allowedHosts: "all"`** so localhost / 127.0.0.1 / LAN do not produce a blank shell. **Do not remove** those without re-validating Storybook on Windows. |
| Storybook (static fallback) | `http://localhost:6007` | **`npm run storybook:static`** — production build + `serve`; use if dev Storybook misbehaves. Port **6007** avoids clashing with dev on **6006**. |

**Next.js dev:** `dev` / `dev:app` use **`next dev --webpack`** (not Turbopack) — Turbopack previously hung on `/` for this app.

**CSS modules:** Do not put **`:root { … }`** in `*.module.css` (Webpack CSS modules reject global selectors and the app/Storybook build can fail). Shared token blocks live in **`app/globals.css`**.

**CI:** GitHub Actions runs **`npm run build-storybook`** after **`npm run check`** so broken Storybook config or stories fail the pipeline. Locally you can run **`npm run check:all`** (lint + Next build + Storybook build) before pushing.

## Terminals (Cursor / agents)

- **`npm run dev`** runs until you stop it. If an agent **backgrounds** the dev server, the IDE will show a shell “running” for tens of minutes — that is **normal**, not a hung build.
- **Prefer `npm run check`** (lint + production build) to verify changes; it **exits** and avoids orphan dev servers. Use **`npm run check:all`** when touching Storybook, `.storybook/`, or stories.
- **Do not** start multiple `next dev` processes for the same app (port conflicts, duplicate work). Only one dev server unless you intentionally use another port.
- **`npm run mcp`** is **stdio-long-lived** by design when Cursor attaches to the MCP server.

## MCP (`npm run mcp`)

Tools include **`vigil_browse_spaces`**, **`vigil_space_summary`**, **`vigil_list_items`**, … (full list in `scripts/mcp-server.mjs`) — names keep the **`vigil_`** prefix for MCP client compatibility; **`HEARTGARDEN_MCP_WRITE_KEY`** on the MCP process must match `write_key` in **`vigil_patch_item`**. **Resources:** `lore://space/<uuid>` (summary + graph JSON). Defaults: **`HEARTGARDEN_DEFAULT_SPACE_ID`**, **`HEARTGARDEN_APP_URL`**. The Next app must be running for HTTP calls to succeed.

## Playwright (`npm run test:e2e`)

- Installs with the repo (`@playwright/test`); browsers: `npx playwright install chromium` (first time).
- Config runs **`npm run build && next start` on `127.0.0.1:3001`** with **`PLAYWRIGHT_E2E=1`** so bootstrap returns an empty demo space even if Neon is configured. This avoids Next’s single-`next dev`-per-folder lock while you keep daily dev on **:3000**.
- **Visual regression:** `e2e/visual/shell.spec.ts` — run **`npm run test:e2e:visual`** locally; **`npm run test:e2e:update`** (or `test:e2e:visual --update-snapshots`) after intentional shell changes. Snapshots are OS-specific (`*-chromium-win32.png` vs `*-chromium-linux.png`). **GitHub Actions sets `CI=1`, which skips `e2e/visual/**`** so Ubuntu CI does not compare against Windows baselines.
- Reuse an existing server only when **`CI` is unset** and something is already listening on **:3001** with the same `PLAYWRIGHT_E2E` bootstrap behavior.

## Hotkeys

Canvas shortcuts use **`e.ctrlKey || e.metaKey`** so **Windows/Linux use Ctrl** and **macOS uses ⌘**. UI copy (`Search (…)`, palette placeholder, context menu) comes from **`useModKeyHints()`** in `src/lib/mod-keys.ts` so labels match the user’s OS.

## Licensing

Do not strip or bypass third-party license UI for any dependency we add. Prefer **MIT** libraries per `docs/HEARTGARDEN_MASTER_PLAN.md`.
