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

## Licensing

Do not strip or bypass third-party license UI for any dependency we add. Prefer **MIT** libraries per `docs/VIGIL_MASTER_PLAN.md`.
