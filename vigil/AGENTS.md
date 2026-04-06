<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# heartgarden — agent notes

## Naming (product vs `vigil/` folder)

**heartgarden** is the app name. The Next.js tree is in **`vigil/`** (legacy directory name). **Vercel** and **CI** use that path until you rename it — steps and stable `vigil:*` IDs (links, MCP tools, CSS tokens, localStorage) are documented in **`docs/NAMING.md`**.

## Source of truth

- **Lore-engine task order (Phases A–D, UX2):** Cursor plan `heartgarden_lore_engine_7fc1fb56.plan.md` under `.cursor/plans/` (YAML todos + narrative).
- **Subsystem → files:** `docs/CODEMAP.md`
- **Shipped features → docs + code:** `docs/FEATURES.md` (collab, canvas chrome, vault UI, editing, media, boot)
- **HTTP API catalog:** `docs/API.md`
- **Product vs repo folder / rename checklist:** `docs/NAMING.md`
- **Repo-wide shipped vs next + hardening backlog:** `docs/BUILD_PLAN.md`
- **Doc index:** `docs/HEARTGARDEN_MASTER_PLAN.md`
- **Historical product bible (dated paths):** `docs/archive/vigil-master-plan-legacy.md` — `docs/VIGIL_MASTER_PLAN.md` is a stub pointer.
- **How the repo should move from here:** `docs/STRATEGY.md`
- **Blocked / account / infra follow-ups:** `docs/FOLLOW_UP.md`

Read **STRATEGY** for the current-vs-target delta, **BUILD_PLAN** for architecture and backlog, and the **Cursor plan** for ordered lore/import/MCP work. The legacy master plan still describes **custom DOM canvas** (no tldraw), **no auth**, **MIT stack**, and phases **1–8** at a product level.

## Current code reality

The **production shell** is **`ArchitecturalCanvasApp`** (`src/components/foundation/ArchitecturalCanvasApp.tsx`), mounted from `app/_components/VigilApp.tsx` (file name is legacy; this is the heartgarden shell). It uses **in-component graph state** (single source of truth for the canvas graph) + Neon sync (`architectural-db-bridge.ts`, `architectural-neon-api.ts`, `/api/bootstrap`, item/space APIs) when not in demo seed mode.

Persistence: **`items`** rows; **`spaces.canvas_state`** is legacy (camera is **browser-local** per space, not written by the shell). Optional **`canvas_presence`** for soft multiplayer awareness (presence + viewport hints). **Links:** wiki-style `vigil:item:` targets in note HTML are resolved in the shell (e.g. **`ArchitecturalLinksPanel`**); cloud mode uses `/api/items/[id]/links` and Neon `item_links`. Shared row types: **`src/model/canvas-types.ts`** (API / mapper shape), separate from **`architectural-types.ts`** (in-memory graph).

**Canvas camera (arrival vs persistence):** Pan/zoom are React state (`translateX` / `translateY` / `scale`) on the scene; **`defaultCamera()`** in **`src/model/canvas-types.ts`** is **`{ x: 0, y: 0, zoom: 1 }`** — world origin, not “center of the window” (half inner width/height would shove content down/right and felt wrong as a first paint). **Bootstrap** (`applyBootstrapData`), **opening a folder** / **`enterSpace`** (UUID spaces), **demo seed**, **recenter**, and **non-default shell** initial layout use that origin (or a **presence follow** override clamped in `enterSpace`). **`src/lib/heartgarden-space-camera.ts`** persists the current view per space while you work; the shell **writes** on those arrivals so storage matches what we show, but **does not read** stored pan on bootstrap/enter — so stale offsets do not override the intentional **0,0** landing. Screen-center math elsewhere (e.g. zoom-to-cursor, minimap “center on world”) is **not** the same as the default arrival camera.

**Lore + vault index:** Cmd+K → **Ask lore** → `LoreAskPanel` → **`POST /api/lore/query`** (hybrid FTS + vector chunks + link neighbors + Anthropic). **`OPENAI_API_KEY`** enables embeddings; debounced **`POST /api/items/:id/index`** from `architectural-neon-api.ts` after note writes. Optional **`HEARTGARDEN_INDEX_AFTER_PATCH=1`**: Next **`after()`** reindex from `schedule-vault-index-after.ts` on PATCH/create. **`HEARTGARDEN_VAULT_DEBUG=1`**: log hybrid RRF ranks. **`HEARTGARDEN_INDEX_SKIP_LORE_META=1`**: vectors-only index default (saves Anthropic on bulk reindex). **Search:** `/api/search` `hybrid` / `semantic` use RRF when embeddings exist; **`GET /api/search/chunks`** for raw chunk hits.

**Neon sync strip:** Top status bar shows **Loading / Local / Saving / Saved / Sync error** via `neon-sync-bus.ts` + instrumented `architectural-neon-api.ts`. **Undo/redo** is in-memory only; tooltips spell out that the server keeps the **last successful write** until the next PATCH. Multiplayer merges and 409 handling reconcile against **server rows**, not a CRDT.

**Theme:** `useVigilTheme` sets `data-vigil-theme` when the user picks light/dark, and toggles **`class="dark"` on `<html>`** whenever the **resolved** appearance is dark (including “Match OS”). Tailwind `dark:*` is overridden in `app/globals.css` (`@custom-variant dark`) to follow that class—not only `prefers-color-scheme`—so chips, glass panels, and hovers match CSS variables.

**Boot + optional flow overlay (default scenario):** Pre-activation **`VigilAppBootScreen`** gates full chrome until the user continues; **`technicalViewportReady`** / **`viewportRevealReady`** separate bootstrap/surface readiness from that choice. With **canvas effects** enabled, **`VigilFlowRevealOverlay`** (`src/components/transition-experiment/`) draws a full-viewport **WebGL** shader on top of the DOM canvas; with effects off it unmounts and **`enterSpace`** skips timed nav dimming. Boot flowers port **`VigilBootFlowerGarden`** below the overlay stack. Details and known gaps (e.g. no `enterSpace` cancel token yet): **`docs/BUILD_PLAN.md`** architecture table.

## Local dev, Node, and Storybook (guardrails)

**Cursor / new agent sessions:** Local run, restart, and **`http://localhost:3000`** defaults (boot gate off in `next dev`, no `dev:preview`) are spelled out in repo root **`.cursor/rules/heartgarden-local-dev.mdc`** — that rule is **`alwaysApply: true`** so agents pick it up without opening `vigil/` first.

**Package manager:** Use **npm** only in the app directory (**`vigil/`** today — see **`docs/NAMING.md`** if renamed) (`package-lock.json`). Do not mix pnpm/yarn in the same tree without a deliberate migration.

**`package-lock.json` vs Ubuntu CI (`npm ci` / “Missing … from lock file”):** A normal **`npm install` on Windows** can drop **Linux-only optional** resolutions (e.g. **`@emnapi/*`** under **`@img/sharp-wasm32`**). GitHub Actions then fails **`npm ci`**. From **`vigil/`**: run **`npm run verify:package-lock-ci`** before pushing (clean temp install with **npm 10.x**, same major as **Node 22** on Actions). If it fails, run **`npm run lockfile:regenerate-linux`**, re-run verify, then **commit `package-lock.json`**.

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
| Storybook (dev) | **`http://127.0.0.1:6006`** | Scripts bind **`127.0.0.1`** explicitly. **Wait for the first webpack compile** (often 30–90s) until the terminal prints a **Local:** URL — opening earlier yields **`ERR_CONNECTION_REFUSED`**. For LAN, use **`npm run storybook:lan`**. Config: **`core.allowedHosts: true`**, React re-pinning in **`.storybook/main.ts`**, **`.storybook/preview-overrides.css`**. Use **Chrome or Edge**; the editor’s embedded browser often cannot reach the dev server. |
| Storybook (static fallback) | **`http://127.0.0.1:6007`** | **`npm run storybook:static`** — build + `serve`; use if dev Storybook will not stay up. Port **6007** avoids clashing with **6006**. |

**Next.js dev:** `dev` / `dev:app` use **`next dev --webpack`** (not Turbopack) — Turbopack previously hung on `/` for this app. **`next dev` turns the boot PIN gate off by default** so **`http://localhost:3000`** works without copying PINs into **`.env.local`**. Set **`HEARTGARDEN_DEV_ENFORCE_BOOT_GATE=1`** to test the PIN flow locally. Deployed / **`next start`** behavior is unchanged. The boot UI only accepts **eight-character** **`HEARTGARDEN_BOOT_PIN_*`** codes; **`HEARTGARDEN_BOOT_SESSION_SECRET`** is server-only.

**CSS modules:** Do not put **`:root { … }`** in `*.module.css` (Webpack CSS modules reject global selectors and the app/Storybook build can fail). Shared token blocks live in **`app/globals.css`**.

**CI:** GitHub Actions runs **`npm run build-storybook`** after **`npm run check`** so broken Storybook config or stories fail the pipeline. Locally you can run **`npm run check:all`** (lint + Next build + Storybook build) before pushing.

**Corrupt `node_modules` (Storybook/Webpack `ENOENT` for `@storybook/*`, `react-refresh`, `html-webpack-plugin`, etc.):** That pattern is almost always a **partial or broken install**, not bad app code. Stop **Next**, **Storybook**, and **Playwright** (anything holding `node_modules`), then from **`vigil/`** run **`npm run reinstall`** (removes **`node_modules`** and runs **`npm ci`**). On Windows, if delete hits **EBUSY** / **EPERM**, close integrated terminals, exit stray **`node.exe`** processes, and retry. **`npm run storybook:doctor`** checks that key packages exist before you spend time on webpack config.

**Database (Neon + vault index):** From **`vigil/`**, **`npm run db:vault-setup`** — pgvector extension, **`drizzle-kit push --force`**, then **`scripts/vault-sql-migrate.mjs`**. **`npm run vault:reindex`** hits **`POST /api/items/:id/index`** for all rows (needs dev server + server-side **`OPENAI_API_KEY`**). GitHub: manual workflow **`heartgarden-db-vault.yml`** + secret **`HEARTGARDEN_NEON_DATABASE_URL`**. Details: **`docs/FOLLOW_UP.md`**.

## Terminals (Cursor / agents)

- **`npm run dev`** runs until you stop it. If an agent **backgrounds** the dev server, the IDE will show a shell “running” for tens of minutes — that is **normal**, not a hung build.
- **Prefer `npm run check`** (lint + production build) to verify changes; it **exits** and avoids orphan dev servers. Use **`npm run check:all`** when touching Storybook, `.storybook/`, or stories.
- **`ERR_CONNECTION_REFUSED`** in the browser for Storybook means **nothing is listening on that port** (process not started, still compiling, or crashed). Keep the terminal running, wait for **Local:** in the log, or run **`npm run storybook:doctor`** / scroll up for webpack errors.
- **Do not** start multiple `next dev` processes for the same app (port conflicts, duplicate work). Only one dev server unless you intentionally use another port.
- **`npm run mcp`** is **stdio-long-lived** by design when Cursor attaches to the MCP server.

## MCP (`npm run mcp`)

Tools include **`vigil_browse_spaces`**, **`vigil_space_summary`**, **`vigil_list_items`**, **`vigil_search`** (default `hybrid`), **`vigil_semantic_search`**, **`vigil_graph`**, **`vigil_get_item`** / **`vigil_get_entity`**, **`vigil_item_links`**, **`vigil_traverse_links`**, **`vigil_related_items`**, **`vigil_title_mentions`**, **`vigil_lore_query`**, **`vigil_index_item`**, **`vigil_reindex_space`**, **`vigil_patch_item`** — see **`scripts/mcp-server.mjs`**. **`HEARTGARDEN_MCP_WRITE_KEY`** must match `write_key` on **`vigil_patch_item`** and **`vigil_reindex_space`**. **Resources:** `lore://space/<uuid>`. Defaults: **`HEARTGARDEN_DEFAULT_SPACE_ID`**, **`HEARTGARDEN_APP_URL`**. The Next app must be running for HTTP calls to succeed.

## Playwright (`npm run test:e2e`)

- Installs with the repo (`@playwright/test`); browsers: `npx playwright install chromium` (first time).
- Config runs **`npm run build && next start` on `127.0.0.1:3001`** with **`PLAYWRIGHT_E2E=1`** so bootstrap returns an empty demo space even if Neon is configured. This avoids Next’s single-`next dev`-per-folder lock while you keep daily dev on **:3000**.
- **Visual regression:** `e2e/visual/shell.spec.ts` — run **`npm run test:e2e:visual`** locally; **`npm run test:e2e:update`** (or `test:e2e:visual --update-snapshots`) after intentional shell changes. Snapshots are OS-specific (`*-chromium-win32.png` vs `*-chromium-linux.png`). **GitHub Actions sets `CI=1`, which skips `e2e/visual/**`** so Ubuntu CI does not compare against Windows baselines.
- Reuse an existing server only when **`CI` is unset** and something is already listening on **:3001** with the same `PLAYWRIGHT_E2E` bootstrap behavior.

## Hotkeys

Canvas shortcuts use **`e.ctrlKey || e.metaKey`** so **Windows/Linux use Ctrl** and **macOS uses ⌘**. UI copy (`Search (…)`, palette placeholder, context menu) comes from **`useModKeyHints()`** in `src/lib/mod-keys.ts` so labels match the user’s OS.

## Licensing

Do not strip or bypass third-party license UI for any dependency we add. Prefer **MIT** libraries per `docs/HEARTGARDEN_MASTER_PLAN.md`.
