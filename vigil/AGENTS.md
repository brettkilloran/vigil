<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# VIGIL — agent notes

## Source of truth

- **Full product & UX spec:** `docs/VIGIL_MASTER_PLAN.md`
- **How the repo should move from here:** `docs/STRATEGY.md`

Read **STRATEGY first** for the current-vs-target delta. The master plan defines **custom DOM canvas** (no tldraw), **no auth**, **MIT stack**, and phases **1–8**.

## Current code reality

The canvas is **custom DOM** (`src/components/canvas/`, `src/stores/canvas-store.ts`). Persistence: **`items`** rows + **`spaces.canvas_state`** as camera `{ x, y, zoom }` only.

**Zustand:** Select **stable** store slices (e.g. `useCanvasStore((s) => s.items)`). Derive lists with `useMemo(() => Object.values(items), [items])`. Avoid selectors that return a **new array or object every call** (e.g. `Object.values(s.items)` inline in the selector)—that causes re-render loops and React 19 `getServerSnapshot` warnings.

## Terminals (Cursor / agents)

- **`npm run dev`** runs until you stop it. If an agent **backgrounds** the dev server, the IDE will show a shell “running” for tens of minutes — that is **normal**, not a hung build.
- **Prefer `npm run check`** (lint + production build) to verify changes; it **exits** and avoids orphan dev servers.
- **Do not** start multiple `next dev` processes for the same app (port conflicts, duplicate work). Only one dev server unless you intentionally use another port.
- **`npm run mcp`** is **stdio-long-lived** by design when Cursor attaches to the MCP server.

## MCP (`npm run mcp`)

Tools: **`vigil_list_items`**, **`vigil_get_item`** (`item_id`), **`vigil_item_links`** (`item_id`), **`vigil_search`** (`q`, optional `mode`, optional `space_id`), **`vigil_graph`** (optional `space_id`). Defaults: **`VIGIL_DEFAULT_SPACE_ID`**, **`VIGIL_APP_URL`** (e.g. `http://localhost:3000`). The Next app must be running for HTTP calls to succeed. REST: **`GET /api/v1/items`** (list by `space_id`) and **`GET /api/v1/items/[itemId]`** (single item).

## Hotkeys

Canvas shortcuts use **`e.ctrlKey || e.metaKey`** so **Windows/Linux use Ctrl** and **macOS uses ⌘**. UI copy (`Search (…)`, palette placeholder, context menu) comes from **`useModKeyHints()`** in `src/lib/mod-keys.ts` so labels match the user’s OS.

## Licensing

Do not strip or bypass third-party license UI for any dependency we add. Prefer **MIT** libraries per `docs/VIGIL_MASTER_PLAN.md`.
