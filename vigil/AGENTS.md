<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# heartgarden — agent notes

## Source of truth

- **Full product & UX spec:** `docs/HEARTGARDEN_MASTER_PLAN.md`
- **How the repo should move from here:** `docs/STRATEGY.md`
- **Blocked / account / infra follow-ups:** `docs/FOLLOW_UP.md`

Read **STRATEGY first** for the current-vs-target delta. The master plan defines **custom DOM canvas** (no tldraw), **no auth**, **MIT stack**, and phases **1–8**.

## Current code reality

The canvas is **custom DOM** (`src/components/canvas/`, `src/stores/canvas-store.ts`). Persistence: **`items`** rows + **`spaces.canvas_state`** as camera `{ x, y, zoom }` only. **Links** panel (local canvas): outgoing/incoming from TipTap `[[` / `vigil:item:` in `content_json` via `src/lib/local-item-links.ts`; cloud mode uses `/api/items/[id]/links` and Neon `item_links`.

**Theme:** `useVigilTheme` sets `data-vigil-theme` when the user picks light/dark, and toggles **`class="dark"` on `<html>`** whenever the **resolved** appearance is dark (including “Match OS”). Tailwind `dark:*` is overridden in `app/globals.css` (`@custom-variant dark`) to follow that class—not only `prefers-color-scheme`—so chips, glass panels, and hovers match CSS variables.

**Zustand:** Select **stable** store slices (e.g. `useCanvasStore((s) => s.items)`). Derive lists with `useMemo(() => Object.values(items), [items])`. Avoid selectors that return a **new array or object every call** (e.g. `Object.values(s.items)` inline in the selector)—that causes re-render loops and React 19 `getServerSnapshot` warnings.

## Terminals (Cursor / agents)

- **`npm run dev`** runs until you stop it. If an agent **backgrounds** the dev server, the IDE will show a shell “running” for tens of minutes — that is **normal**, not a hung build.
- **Prefer `npm run check`** (lint + production build) to verify changes; it **exits** and avoids orphan dev servers.
- **Do not** start multiple `next dev` processes for the same app (port conflicts, duplicate work). Only one dev server unless you intentionally use another port.
- **`npm run mcp`** is **stdio-long-lived** by design when Cursor attaches to the MCP server.

## MCP (`npm run mcp`)

Tools: **`vigil_list_items`**, **`vigil_get_item`**, **`vigil_item_links`**, **`vigil_title_mentions`** (FTS for an item’s title in a space), **`vigil_search`**, **`vigil_graph`**. Defaults: **`HEARTGARDEN_DEFAULT_SPACE_ID`**, **`HEARTGARDEN_APP_URL`** (e.g. `http://localhost:3000`). The Next app must be running for HTTP calls to succeed. REST: **`GET /api/v1/items`** (list by `space_id`) and **`GET /api/v1/items/[itemId]`** (single item).

## Playwright (`npm run test:e2e`)

- Installs with the repo (`@playwright/test`); browsers: `npx playwright install chromium` (first time).
- Config runs **`npm run build && next start` on `127.0.0.1:3001`** with **`PLAYWRIGHT_E2E=1`** so bootstrap returns an empty demo space even if Neon is configured. This avoids Next’s single-`next dev`-per-folder lock while you keep daily dev on **:3000**.
- **Visual regression:** `e2e/visual/shell.spec.ts` — run **`npm run test:e2e:visual`** locally; **`npm run test:e2e:update`** (or `test:e2e:visual --update-snapshots`) after intentional shell changes. Snapshots are OS-specific (`*-chromium-win32.png` vs `*-chromium-linux.png`). **GitHub Actions sets `CI=1`, which skips `e2e/visual/**`** so Ubuntu CI does not compare against Windows baselines.
- Reuse an existing server only when **`CI` is unset** and something is already listening on **:3001** with the same `PLAYWRIGHT_E2E` bootstrap behavior.

## Hotkeys

Canvas shortcuts use **`e.ctrlKey || e.metaKey`** so **Windows/Linux use Ctrl** and **macOS uses ⌘**. UI copy (`Search (…)`, palette placeholder, context menu) comes from **`useModKeyHints()`** in `src/lib/mod-keys.ts` so labels match the user’s OS.

## Licensing

Do not strip or bypass third-party license UI for any dependency we add. Prefer **MIT** libraries per `docs/HEARTGARDEN_MASTER_PLAN.md`.
