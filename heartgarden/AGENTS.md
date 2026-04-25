---
title: heartgarden — agent notes
status: canonical
audience: [agent, human]
last_reviewed: 2026-04-21
canonical: true
related:
  - docs/API.md
  - docs/BUILD_PLAN.md
  - docs/FEATURES.md
  - docs/CODEMAP.md
  - docs/LORE_ENGINE_ROADMAP.md
---

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# heartgarden — agent notes

**Read order (LLM / onboarding):** `AGENTS.md` (this file) → `docs/AGENT_COLLABORATION.md` → `docs/API.md` → `docs/FEATURES.md` → `docs/CODEMAP.md` → `docs/BUILD_PLAN.md` (architecture + shipped history) → `docs/BACKLOG.md` (open engineering work, SOT). **Env matrix (deploy):** `docs/VERCEL_ENV_VARS.md`. **Lore vertical pointer:** `docs/LORE_ENGINE_ROADMAP.md` + repo `.cursor/plans/README.md`.

## Naming (product vs `heartgarden/` folder)

**heartgarden** is the app name. The Next.js tree lives in **`heartgarden/`** in git. **Vercel** and **CI** use that path. Stable **`vigil:*`** link scheme, CSS tokens, and localStorage keys are documented in **`docs/NAMING.md`** (MCP tools are **`heartgarden_*`**; **`vigil_*`** tool names are still accepted as aliases).

## Source of truth (canonical docs)

| Concern | Document |
|--------|----------|
| **Onboarding + architecture reality** | This file (`AGENTS.md`) |
| **Human / agent / GitHub collaboration policy** | `docs/AGENT_COLLABORATION.md` |
| **HTTP routes** | `docs/API.md` |
| **Shipped behavior → code** | `docs/FEATURES.md` |
| **Subsystem → files** | `docs/CODEMAP.md` |
| **Open engineering backlog (SOT)** | `docs/BACKLOG.md` |
| **Architecture snapshot + shipped tranches history** | `docs/BUILD_PLAN.md` |
| **Env vars (Vercel)** | `docs/VERCEL_ENV_VARS.md` |
| **Players / GM / collab** | `docs/PLAYER_LAYER.md` |
| **Optional WebSocket realtime (Redis + separate `pnpm run realtime` host)** | `docs/DEPLOY_VERCEL.md` §5.5, `docs/API.md` (Realtime), `docs/CODEMAP.md` |
| **Naming (paths vs stable `vigil:*` data)** | `docs/NAMING.md` |
| **Lore vertical + plan index** | `docs/LORE_ENGINE_ROADMAP.md`, repo `.cursor/plans/README.md` |
| **Lore node UI patterns** | `docs/CANVAS_LORE_NODE_PATTERNS.md` |
| **Character focus + data model / sync / migration plan** | `docs/CHARACTER_FOCUS_AND_DATA_MODEL_PLAN.md` |
| **hgDoc editor + AI / import pending marks (`hgAiPending`)** | `docs/EDITOR_HG_DOC.md` (see also `docs/FEATURES.md`, `docs/CODEMAP.md`) |
| **Doc index (links only)** | `docs/HEARTGARDEN_MASTER_PLAN.md` |
| **Engineering delta / phase notes** | `docs/STRATEGY.md` |
| **Human / keys / infra** | `docs/FOLLOW_UP.md` |
| **Historical product bible** | `docs/archive/vigil-master-plan-legacy.md` — stub: `docs/VIGIL_MASTER_PLAN.md` |

Read **STRATEGY** for current-vs-target delta, **BACKLOG** for open work (SOT), and **BUILD_PLAN** for architecture + shipped history. **Do not** treat a single missing `.cursor/plans/*.plan.md` filename as SoT — use **LORE_ENGINE_ROADMAP** + **plans README** + **BACKLOG**. The legacy master plan still describes **custom DOM canvas** (no tldraw), **boot-tier access** (not full user accounts), **MIT stack**, and phases **1–8** at a product level.

## Collaboration policy (humans, agents, GitHub)

Canonical workflow guidance lives in **`docs/AGENT_COLLABORATION.md`**. In short: Brett-directed Cursor work should bias toward action; Matt's comments are trusted peer-review input; agents may do reversible local work, open PRs, and leave clear GitHub comments without extra ceremony; agents must ask before disruptive one-way doors such as merges, PR/issue closes, branch deletes, force-pushes, production data/env/auth changes, or expensive open-ended loops.

## Documentation update checklist

When you change behavior or contracts:

1. Update **`docs/API.md`** if any `app/api/**` route shape or env requirement changed.
2. Update **`docs/FEATURES.md`** and/or **`docs/CODEMAP.md`** if user-visible behavior or primary file locations changed.
3. Update **`docs/BACKLOG.md`** when you **add** or **retire** an open engineering item (SOT for open work). Update **`docs/BUILD_PLAN.md`** Completed-tranches table when work **ships**.
4. Update **`docs/VERCEL_ENV_VARS.md`** if a new env var ships (narrative deploy docs should **link** here, not duplicate the full matrix).
5. Keep **`AGENTS.md`** “Current code reality” in sync for shell/bootstrap/camera/lore **only** when those subsystems change.
6. The historical functional PRD lives under **`docs/archive/FUNCTIONAL_PRD_REBUILD.md`** (stub: **`docs/FUNCTIONAL_PRD_REBUILD.md`**). Update it only when intentionally revisiting that archived spec.

## Current code reality

The **production shell** is **`ArchitecturalCanvasApp`** (`src/components/foundation/ArchitecturalCanvasApp.tsx`), mounted from `app/_components/VigilApp.tsx` (file name is legacy; this is the heartgarden shell). It uses **in-component graph state** (single source of truth for the canvas graph) + Neon sync (`architectural-db-bridge.ts`, `architectural-neon-api.ts`, `/api/bootstrap`, item/space APIs) when not in demo seed mode.

Persistence: **`items`** rows; **`spaces.canvas_state`** is legacy (camera is **browser-local** per space, not written by the shell). Optional **`canvas_presence`** for soft multiplayer awareness (presence + viewport hints). **Links:** wiki-style `vigil:item:` targets in note HTML are resolved in the shell (e.g. **`ArchitecturalLinksPanel`**); cloud mode uses `/api/items/[id]/links` and Neon `item_links`. Shared row types: **`src/model/canvas-types.ts`** (API / mapper shape), separate from **`architectural-types.ts`** (in-memory graph).

**Semantic canvas thread linking (draw mode):** Completing a pin connection in **draw** mode runs **`runSemanticThreadLinkEvaluation`** in **`src/lib/canvas-thread-link-eval.ts`**. **Faction + roster row:** merges the character onto `hgArch.factionRoster` and mirrors **`hgArch.loreThreadAnchors`** on the character (`primaryFactionItemId`, `primaryFactionRosterEntryId`). **Character + location** (no roster id on the completing click): sets **`primaryLocationItemId`** on the character and appends the character id to **`linkedCharacterItemIds`** on the location. **Pointer rule:** `mousedown` does **not** bail early on **`[data-hg-doc-editor]`** while `connectionMode !== "move"`, so TipTap surfaces remain valid link endpoints. Persist: **`buildContentJsonForContentEntity`** writes `loreThreadAnchors`; **`architectural-db-bridge`** reads it back into **`CanvasContentEntity`**.

**Canvas camera (arrival vs persistence):** Pan/zoom are React state (`translateX` / `translateY` / `scale`) on the scene; **`defaultCamera(viewportW, viewportH)`** in **`src/model/canvas-types.ts`** places **world (0,0) at the viewport center** with zoom 1 (`translate` ≈ half the measured viewport in CSS pixels). **Bootstrap** (`applyBootstrapData`), **opening a folder** / **`enterSpace`**, **demo seed**, **recenter**, and **non-default shell** initial layout use that home camera (or a **presence follow** override clamped in `enterSpace`). **`src/lib/heartgarden-space-camera.ts`** persists the current view per space while you work; the shell **writes** on those arrivals so storage matches what we show, but **does not read** stored pan on bootstrap/enter — so stale offsets do not override the intentional centered landing.

**Folder delete semantics:** Deleting a folder in the shell now removes the folder node itself while popping its immediate children (items and sub-folders) up into the parent space with preserved relative offsets (`parentSlot + childSlot`). Nested sub-folder internals are preserved (one-layer pop-out only). Cloud sync sends item/space reparent PATCHes before folder/item/space DELETE calls.

**Lore + vault index:** HTTP flow diagram (debounced client index vs `after()` hook vs core indexer) — **`docs/API.md`** → **Vault index orchestration**. Cmd+K → **Ask lore** → `LoreAskPanel` → **`POST /api/lore/query`** (FTS + fuzzy + link neighbors + Anthropic; vector chunks when **`OPENAI_API_KEY`** is set — **`src/lib/embedding-provider.ts`** uses OpenAI **`text-embedding-3-small`** by default; omit the key for lexical-only hybrid). **`buildItemVaultCorpus`** (`item-searchable-text.ts`) is the shared plain-text projection for **`items.search_blob`**, vault embeddings, and lore excerpt fallbacks: title, `content_text`, TipTap hgDoc + HTML `content_json`, `entity_meta`, image fields, lore summary/aliases. Debounced **`POST /api/items/:id/index`** from `architectural-neon-api.ts` after note writes. **`HEARTGARDEN_INDEX_AFTER_PATCH`**: Next **`after()`** vault reindex from `schedule-vault-index-after.ts` on PATCH/create is **on by default**; it uses **`refreshLoreMeta: false`** (chunks/embeddings only, **no Anthropic**) so it does not duplicate the debounced client **`POST /api/items/:id/index`**, which still refreshes lore meta by default. Set **`HEARTGARDEN_INDEX_AFTER_PATCH=0`** (or `false` / `off`) to disable the server hook. **`HEARTGARDEN_VAULT_DEBUG=1`**: log hybrid RRF ranks. **`HEARTGARDEN_INDEX_SKIP_LORE_META=1`**: skip Anthropic lore meta on **all** reindex paths including client index (saves API calls on bulk reindex). **`lore_meta_source_hash`** on **`items`**: vault reindex skips the Anthropic lore-meta call when the title + content_text prompt is unchanged (same trim/length cap as `extractLoreItemMeta`); embeddings still refresh. **`HEARTGARDEN_LORE_META_IGNORE_SOURCE_HASH=1`**: bypass that skip (e.g. new `ANTHROPIC_LORE_MODEL`). Anthropic wrapper flags are documented in **`docs/VERCEL_ENV_VARS.md`** (`HEARTGARDEN_ANTHROPIC_CACHE_*`, `HEARTGARDEN_ANTHROPIC_DEBUG`, `HEARTGARDEN_ANTHROPIC_THINKING_*`, retry/continuation/output caps, and job timeout). **Search:** `/api/search` `hybrid` / `semantic` use RRF when embeddings exist; **`GET /api/search/chunks`** for raw chunk hits.

**AI / import review (hgDoc):** Pending AI or import text uses the TipTap **`hgAiPending`** mark (serialized as `data-hg-ai-pending` spans). **`HeartgardenDocEditor`** can show a margin **Bind** control per pending range; **Unreviewed** / **Accept** on cards tie to **`items.entity_meta.aiReview`** when the body still has pending markup. Lore **canvas** HTML plates inherit global pending styling for wrapped spans but do not use the hgDoc gutter. Details: **`docs/EDITOR_HG_DOC.md`**, **`docs/FEATURES.md`**, **`docs/CODEMAP.md`**. Import HTTP surface: **`docs/API.md`** (lore import). Canonical kind → DB mapping: **`docs/LORE_IMPORT_KIND_MAPPING.md`**.

**Multi-mode / release smoke:** Before shipping shell, sync, or import changes, run the **three-track** manual playbook in **`docs/DATA_PIPELINE_AUDIT_2026-04-11.md`** §4 — **Track A** (Neon GM), **Track B** (demo/local), **Track C** (Players tier). This is the closest thing to an integration gate for tier bleed; optional CI only covers slices (e.g. demo boot). **localStorage** camera keys are shared across tiers on one browser profile — see audit §5; namespacing is a roadmap item in **`.cursor/plans/data_pipeline_import_hardening.plan.md`**.

**Neon sync strip:** Top status bar shows **Loading / Local / Saving / Saved / Sync error** via `neon-sync-bus.ts` + instrumented `architectural-neon-api.ts`. **Undo/redo** is in-memory only; tooltips spell out that the server keeps the **last successful write** until the next PATCH. Multiplayer merges and 409 handling reconcile against **server rows**, not a CRDT. **`useHeartgardenSpaceChangeSync`** defers **interval** delta polls while inline/focus is dirty or a **`PATCH`** is in flight (catch-up after idle); protected merges preserve local title/body for those ids; **`apiPatchItem`** serializes in-flight **PATCH** requests per item. Optional **`NEXT_PUBLIC_HEARTGARDEN_SYNC_DEBUG=1`** enables browser **`console.debug`** for PATCH latency — **`docs/API.md`** (browser shell subsections), **`docs/FEATURES.md`** (Collaboration & sync).

**Theme:** `useVigilTheme` sets `data-vigil-theme` when the user picks light/dark, and toggles **`class="dark"` on `<html>`** whenever the **resolved** appearance is dark (including “Match OS”). Tailwind `dark:*` is overridden in `app/globals.css` (`@custom-variant dark`) to follow that class—not only `prefers-color-scheme`—so chips, glass panels, and hovers match CSS variables.

**Boot + optional flow overlay (default scenario):** Pre-activation **`VigilAppBootScreen`** gates full chrome until the user continues; **`technicalViewportReady`** / **`viewportRevealReady`** separate bootstrap/surface readiness from that choice. With **canvas effects** enabled, **`VigilFlowRevealOverlay`** (`src/components/transition-experiment/`) draws a full-viewport **WebGL** shader on top of the DOM canvas; with effects off it unmounts and **`enterSpace`** skips timed nav dimming. Boot flowers port **`VigilBootFlowerGarden`** below the overlay stack. **Bootstrap:** If **`GET /api/bootstrap`** cannot return a real workspace (`demo: true`, offline, etc.), **open gate** (`gateEnabled: false`) loads the **local nested demo canvas** (`applyDemoLocalCanvas` in `ArchitecturalCanvasApp.tsx`) so dev and **Playwright** (`PLAYWRIGHT_E2E=1`) are usable without Neon. **Boot gate on** (e.g. Bishop/access) in the same failure path still uses the **workspace-unavailable** overlay when there is no cache snapshot. Details and known gaps (e.g. no `enterSpace` cancel token yet): **`docs/BUILD_PLAN.md`** architecture table.

**API boot gate (production PIN):** Root **`proxy.ts`** (matcher **`/api/:path*`**) returns **403** for **`/api/*`** without a valid **`hg_boot`** cookie (or MCP Bearer allowlist), except allowlisted paths such as **`/api/heartgarden/boot`** and **`/api/mcp`**. Docs and older notes may say “middleware”; the behavior is the same. **`docs/API.md`** (Bootstrap, MCP).

## Local dev, Node, and Storybook (guardrails)

**Cursor / new agent sessions:** Local run, restart, and **`http://localhost:3000`** defaults (boot gate off in `next dev`, no `dev:preview`) are spelled out in repo root **`.cursor/rules/heartgarden-local-dev.mdc`** — that rule is **`alwaysApply: true`** so agents pick it up without opening `heartgarden/` first.

**Package manager:** Use **pnpm** only in the app directory (**`heartgarden/`**) (`pnpm-lock.yaml`; version pinned via `packageManager` in `package.json`). Do not mix npm/yarn in the same tree without a deliberate migration.

**`pnpm audit`:** Treat **`pnpm audit`** as advisory — many findings are in **dev-only** transitive chains and do not map directly to production risk. Prefer **`pnpm audit --fix`** when it stays within compatible ranges. Avoid forced major upgrades unless you are ready to reconcile **peer dependencies** and to run **`pnpm run check`**, **`pnpm run build`**, and **`pnpm run build-storybook`** (or **`pnpm run check:all`**). A bad forced upgrade can leave **`package.json`** / **`pnpm-lock.yaml`** and **`node_modules`** out of sync; **`pnpm run reinstall`** rebuilds **`node_modules`** from the lockfile after you restore the manifests from git.

**GitHub CLI on PATH (Windows / Cursor terminals):** GitHub CLI is already installed on Brett's machine at **`C:\Program Files\GitHub CLI\gh.exe`** and is authenticated with repo access. If a Cursor terminal says **`gh`** is not recognized, refresh the process PATH before using it:

```powershell
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
gh auth status
```

**Node on PATH (Windows portable installs):** If `pnpm`/`node` are missing in a new terminal or in Cursor, the portable Node folder is probably not on **User** `PATH`.

**First-time setup or after upgrading Node portable:**

1. Download **Windows x64 Binary (.zip)** from [Node.js downloads](https://nodejs.org/en/download/) (pick the version you want).
2. Extract the zip so you have a folder like  
   `%LOCALAPPDATA%\node-portable\node-v24.x.x-win-x64`  
   (sibling to any older `node-v*-win-x64` folders is fine).
3. From the `heartgarden/` folder, run:
   - `powershell -ExecutionPolicy Bypass -File scripts/pin-portable-node-user-path.ps1`
4. **Restart Cursor** (or close all integrated terminals and open a new one) so they read the updated User `PATH`.

The script picks the **newest** `node-v*-win-x64` under `%LOCALAPPDATA%\node-portable\`, points `%LOCALAPPDATA%\node-portable\current` at it (junction), and prepends `current` to your **User** `PATH` — so the next upgrade is always: **unzip new version → run script again → restart Cursor**.

**Daily dev URLs:** From `heartgarden/`, prefer **`pnpm run dev:surfaces`** (app + Storybook). Use a normal browser (**Chrome / Edge**), not the editor’s embedded browser, for Storybook.

| Surface | URL | Notes |
|--------|-----|--------|
| heartgarden (Next) | `http://localhost:3000` | `next.config.ts` **`allowedDevOrigins`** includes `localhost` and `127.0.0.1` so dev HMR is not blocked when mixing those hosts. If you use the **Network** URL from the dev banner, add that **hostname** to `allowedDevOrigins` too. |
| Storybook (dev) | **`http://127.0.0.1:6006`** | Scripts bind **`127.0.0.1`** explicitly. **Wait for the first webpack compile** (often 30–90s) until the terminal prints a **Local:** URL — opening earlier yields **`ERR_CONNECTION_REFUSED`**. For LAN, use **`pnpm run storybook:lan`**. Config: **`core.allowedHosts: true`**, React re-pinning in **`.storybook/main.ts`**, **`.storybook/preview-overrides.css`**. Use **Chrome or Edge**; the editor’s embedded browser often cannot reach the dev server. |
| Storybook (static fallback) | **`http://127.0.0.1:6007`** | **`pnpm run storybook:static`** — build + `serve`; use if dev Storybook will not stay up. Port **6007** avoids clashing with **6006**. |

**Next.js dev:** `dev` / `dev:app` use **`next dev --webpack`** (not Turbopack) — Turbopack previously hung on `/` for this app. **`next dev` turns the boot PIN gate off by default** so **`http://localhost:3000`** works without copying PINs into **`.env.local`**. Set **`HEARTGARDEN_DEV_ENFORCE_BOOT_GATE=1`** to test the PIN flow locally. Deployed / **`next start`** behavior is unchanged. The boot UI only accepts **eight-character** **`HEARTGARDEN_BOOT_PIN_*`** codes; **`HEARTGARDEN_BOOT_SESSION_SECRET`** is server-only.

**CSS modules:** Do not put **`:root { … }`** in `*.module.css` (Webpack CSS modules reject global selectors and the app/Storybook build can fail). Shared token blocks live in **`app/globals.css`**.

**CI:** GitHub Actions runs **`pnpm run build-storybook`** after **`pnpm run check`** so broken Storybook config or stories fail the pipeline. Locally you can run **`pnpm run check:all`** (lint + Next build + Storybook build) before pushing.

**Unit tests (`pnpm run test:unit`):** Vitest is configured for **Node** only (`vitest.config.ts`); there is no browser Vitest project unless we add one later. **`drizzle-kit`** is a **devDependency** (CLI + `drizzle.config.ts`); run **`pnpm run db:*`** from a tree with dev dependencies installed (local dev or CI), not from a production-only install that omits dev deps.

**Corrupt `node_modules` (Storybook/Webpack `ENOENT` for `@storybook/*`, `react-refresh`, `html-webpack-plugin`, etc.):** That pattern is almost always a **partial or broken install**, not bad app code. Stop **Next**, **Storybook**, and **Playwright** (anything holding `node_modules`), then from **`heartgarden/`** run **`pnpm run reinstall`** (removes **`node_modules`** and runs **`pnpm install --frozen-lockfile`**). On Windows, if delete hits **EBUSY** / **EPERM**, close integrated terminals, exit stray **`node.exe`** processes, and retry. **`pnpm run storybook:doctor`** checks that key packages exist before you spend time on webpack config.

**Database (Neon + vault index):** From **`heartgarden/`**, **`pnpm run db:vault-setup`** — pgvector extension, **`drizzle-kit push --force`**, then **`scripts/vault-sql-migrate.mjs`**. The SQL script replays **every** file in **`drizzle/migrations/`** in lex order (idempotent — each file uses `IF NOT EXISTS` / `DO $$` guards), so new migrations are picked up on the next run. Rerun **`pnpm run db:vault-setup`** after any schema or migration change on **each** target (local, Preview, Production). **`pnpm run vault:reindex`** hits **`POST /api/items/:id/index`** for all rows (needs dev server). GitHub: manual workflow **`heartgarden-db-vault.yml`** + secret **`HEARTGARDEN_NEON_DATABASE_URL`**. Details: **`docs/FOLLOW_UP.md`**.

## Terminals (Cursor / agents)

- **`pnpm run dev`** runs until you stop it. If an agent **backgrounds** the dev server, the IDE will show a shell “running” for tens of minutes — that is **normal**, not a hung build.
- **Prefer `pnpm run check`** (lint + production build) to verify changes; it **exits** and avoids orphan dev servers. Use **`pnpm run check:all`** when touching Storybook, `.storybook/`, or stories.
- **`ERR_CONNECTION_REFUSED`** in the browser for Storybook means **nothing is listening on that port** (process not started, still compiling, or crashed). Keep the terminal running, wait for **Local:** in the log, or run **`pnpm run storybook:doctor`** / scroll up for webpack errors.
- **Do not** start multiple `next dev` processes for the same app (port conflicts, duplicate work). Only one dev server unless you intentionally use another port.
- **`pnpm run mcp`** is **stdio-long-lived** by design when Cursor attaches to the MCP server.

## MCP (`pnpm run mcp` + hosted HTTP)

**Implementation:** shared server logic in **`src/lib/mcp/heartgarden-mcp-server.ts`**; **stdio** entry **`scripts/mcp-server.ts`** (`pnpm run mcp`); **Streamable HTTP** endpoint **`GET|POST|DELETE /api/mcp`** (Bearer auth, stateless transport).

Tools include **`heartgarden_browse_spaces`**, **`heartgarden_mcp_config`** (whether a default space / write key is configured—no secrets), **`heartgarden_space_summary`**, **`heartgarden_list_items`**, **`heartgarden_search`** (default `hybrid`), **`heartgarden_semantic_search`**, **`heartgarden_graph`**, **`heartgarden_get_item`**, **`heartgarden_get_item_outline`** (**`heartgarden_get_entity`** is a call alias, not a separately listed tool), **`heartgarden_item_links`**, **`heartgarden_traverse_links`** (default explicit-link traversal; pass **`implicit_mode: true`** to also include **`entity_mentions`** neighbors), **`heartgarden_entity_mentions`** (term-based implicit mention edges for one item — outgoing mentions and items that mention this one), **`heartgarden_related_items`**, **`heartgarden_title_mentions`**, **`heartgarden_lore_query`**, **`heartgarden_index_item`**, **`heartgarden_patch_item`**, **`heartgarden_create_item`**, **`heartgarden_create_folder`**, **`heartgarden_create_link`**, **`heartgarden_update_link`**, **`heartgarden_delete_item`**, **`heartgarden_delete_link`**. Create/patch prose input precedence is **`content_json > content_blocks > content_markdown > content_text`**; markdown/blocks compile to hgDoc with heading lint+repair and H1 auto-prepend for generic docs. Space-wide vault reindex remains available via **`POST /api/spaces/:id/reindex`** (not exposed as an MCP tool). **`HEARTGARDEN_MCP_WRITE_KEY`** must match `write_key` on write tools (**`heartgarden_patch_item`** also allows omitting `write_key` when this env is set on the MCP process, like create tools). **`HEARTGARDEN_MCP_SERVICE_KEY`**: required on the server for **`/api/mcp`** (503 if unset); use the same value when calling tools so internal `fetch` calls pass the boot gate in production (**`Authorization: Bearer …`**). Query-token auth (`?token=` / `?key=`) is off by default; set **`HEARTGARDEN_MCP_ALLOW_QUERY_TOKEN=1`** only for compatibility clients that cannot send headers. **Resources:** `lore://space/<uuid>`. Defaults: **`HEARTGARDEN_DEFAULT_SPACE_ID`**, **`HEARTGARDEN_APP_URL`**. Canvas + MCP field reference: **`docs/MCP_CANVAS_MODEL.md`**. The Next app must be reachable for HTTP tool calls. **Legacy:** clients may still invoke **`vigil_*`** tool names; the server maps them to **`heartgarden_*`**.

**Claude Desktop (remote URL):** prefer header auth when supported. For URL-token connector compatibility, set **`HEARTGARDEN_MCP_ALLOW_QUERY_TOKEN=1`** and use **Remote MCP server URL** **`https://<your-domain>/api/mcp?token=<HEARTGARDEN_MCP_SERVICE_KEY>`** (same value as in Vercel; percent-encode if needed). OAuth fields stay empty. **Smoke test (same SDK transport as Desktop):** from **`heartgarden/`**, `HEARTGARDEN_MCP_SERVICE_KEY=… pnpm run mcp:smoke` (optional **`HEARTGARDEN_MCP_URL`** for non-prod; optional **`HEARTGARDEN_VERCEL_PROTECTION_BYPASS`** if testing a protected deployment). Prefer **`Authorization: Bearer`** when the client supports it — query tokens may appear in access logs.

**Vercel:** If **Deployment Protection** / SSO is on for that hostname, **no MCP traffic reaches the app** (Claude cannot log in to Vercel). Use a **public Production** URL or configure protection in **`docs/DEPLOY_VERCEL.md`** (MCP and Deployment Protection).

## Playwright (`pnpm run test:e2e`)

- Installs with the repo (`@playwright/test`); browsers: `pnpm exec playwright install chromium` (first time).
- Config runs **`pnpm run build && next start` on `127.0.0.1:3001`** with **`PLAYWRIGHT_E2E=1`** so bootstrap returns an empty demo space even if Neon is configured. This avoids Next’s single-`next dev`-per-folder lock while you keep daily dev on **:3000**.
- **Visual regression:** `e2e/visual/shell.spec.ts` — run **`pnpm run test:e2e:visual`** locally; **`pnpm run test:e2e:update`** (or `test:e2e:visual --update-snapshots`) after intentional shell changes. Snapshots are OS-specific (`*-chromium-win32.png` vs `*-chromium-linux.png`). **GitHub Actions sets `CI=1`, which skips `e2e/visual/**`** so Ubuntu CI does not compare against Windows baselines.
- Reuse an existing server only when **`CI` is unset** and something is already listening on **:3001** with the same `PLAYWRIGHT_E2E` bootstrap behavior.

## Hotkeys

Canvas shortcuts use **`e.ctrlKey || e.metaKey`** so **Windows/Linux use Ctrl** and **macOS uses ⌘**. UI copy (`Search (…)`, palette placeholder, context menu) comes from **`useModKeyHints()`** in `src/lib/mod-keys.ts` so labels match the user’s OS.

## Licensing

Do not strip or bypass third-party license UI for any dependency we add. Prefer **MIT** libraries per `docs/HEARTGARDEN_MASTER_PLAN.md`.
