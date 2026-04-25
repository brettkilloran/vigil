# ESLint warnings — pnpm build (2026-04-25)

Captured from a successful Vercel deploy of `clean-up-dev` (commit `c6a0e4e`, Next.js 16.2.2 webpack mode, pnpm 10.33.2).

**Total: 106 warnings, 0 errors.** 3 warnings are auto-fixable (`--fix`).

These warnings come from stricter React 19 hooks rules in `eslint-plugin-react-hooks` that pnpm resolves to newer versions than npm did. They were downgraded from errors to warnings in `eslint.config.mjs` to unblock deploys.

---

## Summary by rule

| Rule | Count | Severity | Description |
|------|------:|----------|-------------|
| `react-hooks/set-state-in-effect` | 42 | warn | Calling `setState` synchronously inside a `useEffect` body triggers cascading renders. |
| `react-hooks/refs` | 50 | warn | Accessing or writing `ref.current` during render (outside effects/handlers). |
| `react-hooks/purity` | 1 | warn | Calling an impure function during render. |
| `react-hooks/immutability` | 1 | warn | Mutating a value that React expects to be immutable during render. |
| Unused `eslint-disable` directive | 3 | warn | Stale `eslint-disable` comments for `react-hooks/set-state-in-effect` that no longer suppress anything. Auto-fixable. |
| `@typescript-eslint/no-unused-vars` | 1 | warn | Unused variable `previousKeyToId` in `entity-mentions.ts`. |

> Note: the `@typescript-eslint/no-unused-vars` and `entity-mentions.ts` warnings were present in earlier builds but were fixed in commit `48d95e9`. The 106-warning count is from the final successful build.

---

## Warnings by file

### `src/components/foundation/ArchitecturalCanvasApp.tsx` — 82 warnings

The largest file in the codebase (~15 000 lines). The vast majority of warnings are here.

#### `react-hooks/refs` (39 instances)

Lines 2594, 3434–3458, 4367, 4375, 5839, 6069 (×7), 6204, 6222, 6274, 6303, 6357, 6529, 6624, 9957, 9959, 9961, 11968, 12191, 12212, 12348, 14389, 14419, 14420, 14849.

Pattern: the component syncs state into refs during render for use in event handlers and effects (`someRef.current = someState`). This is a common React pattern for "latest value" refs but the new rule flags it.

**Fix approach:** wrap the `ref.current = value` assignments in `useEffect` blocks (or use a `useLatest(value)` helper that does this internally). For the block at lines 3434–3458, a single `useEffect` that syncs ~20 refs would replace ~20 top-level assignments.

#### `react-hooks/set-state-in-effect` (32 instances)

Lines 2639, 2666, 2936, 3021, 3461, 3464, 3467, 3470, 3482, 4846, 5144, 5866, 6690, 6893, 6950, 6969, 6984, 7015, 7033, 8103, 10598, 12305, 12310, 12329, 12333, 12342, 12432, 12459.

Pattern: effects that fetch data or subscribe to external state call `setState` in the effect body or in a synchronous callback. React 19 prefers deriving state during render or using a subscription callback.

**Fix approach:** case-by-case. Many are legitimate external-state subscriptions that call `setState` in a listener callback (already correct). Others are "initialize from localStorage" patterns that could use `useSyncExternalStore` or initializer functions.

#### `react-hooks/purity` (2 instances)

Lines 2810, 7819, 7827.

Pattern: calling a function with side effects (e.g. logging, ref reads) during the render phase.

#### `react-hooks/immutability` (1 instance)

Line 3447.

Pattern: assigning to `activeSpaceIdRef.current` during render — the rule sees this as mutating a ref (immutable during render).

#### Unused `eslint-disable` directives (2 instances)

Lines 376, 714.

Stale `// eslint-disable-next-line react-hooks/set-state-in-effect` comments that no longer suppress a warning (the code they guarded was refactored). Auto-fixable with `--fix`.

---

### `src/components/dev/EntityGraphLab.tsx` — 1 warning

| Line | Rule | Detail |
|------|------|--------|
| 146 | `react-hooks/set-state-in-effect` | `setLayout(...)` called inside a `useEffect`. |

---

### `src/components/dev/EntityGraphPillCanvas.tsx` — 4 warnings

| Line | Rule | Detail |
|------|------|--------|
| 129 | `react-hooks/set-state-in-effect` | `setDisplayLayout(...)` inside effect. |
| 142 | `react-hooks/set-state-in-effect` | `setDisplayLayout(...)` inside effect. |
| 249 | `react-hooks/set-state-in-effect` | `setDisplayLayout(...)` inside animation frame effect. |
| 257 | `react-hooks/set-state-in-effect` | `setDisplayLayout(...)` inside animation frame effect. |

---

### `src/components/foundation/ArchitecturalBottomDock.tsx` — 2 warnings

| Line | Rule | Detail |
|------|------|--------|
| 376 | unused `eslint-disable` | Stale directive for `react-hooks/set-state-in-effect`. |
| 714 | unused `eslint-disable` | Stale directive for `react-hooks/set-state-in-effect`. |

> Note: line numbers here are from the Vercel build and may differ slightly from local due to CRLF handling. These are the same file as the 2 unused-disable entries above.

---

### `src/components/foundation/ArchitecturalLoreReviewPanel.tsx` — 1 warning

| Line | Rule | Detail |
|------|------|--------|
| 78 | `react-hooks/set-state-in-effect` | `setState` in effect body. |

---

### `src/components/foundation/LoreLocationOrdoV7Slab.tsx` — 1 warning

| Line | Rule | Detail |
|------|------|--------|
| 455 | unused `eslint-disable` | Stale directive for `react-hooks/set-state-in-effect`. |

---

### `src/components/product-ui/canvas/ArchitecturalLinksPanel.tsx` — 2 warnings

| Line | Rule | Detail |
|------|------|--------|
| 54 | `react-hooks/set-state-in-effect` | `setState` in effect body. |
| 92 | `react-hooks/set-state-in-effect` | `setState` in effect body. |

---

### `src/components/product-ui/canvas/CommandPalette.tsx` — 3 warnings

| Line | Rule | Detail |
|------|------|--------|
| 118 | `react-hooks/set-state-in-effect` | `setState` in effect body. |
| 210 | `react-hooks/set-state-in-effect` | `setState` in effect body. |
| 389 | `react-hooks/set-state-in-effect` | `setState` in effect body. |

---

### `src/components/product-ui/canvas/GraphPanel.tsx` — 3 warnings

| Line | Rule | Detail |
|------|------|--------|
| 98 | `react-hooks/set-state-in-effect` | `setState` in effect body. |
| 112 | `react-hooks/set-state-in-effect` | `setState` in effect body. |
| 155 | `react-hooks/set-state-in-effect` | `setState` in effect body. |

---

### `src/components/product-ui/lore/LoreAskPanel.tsx` — 1 warning

| Line | Rule | Detail |
|------|------|--------|
| 75 | `react-hooks/set-state-in-effect` | `setState` in effect body. |

---

### `src/components/transition-experiment/VigilFlowRevealOverlay.tsx` — 3 warnings

| Line | Rule | Detail |
|------|------|--------|
| 299 | `react-hooks/refs` | `sessionActivatedRef.current = sessionActivated` during render. |
| 302 | `react-hooks/refs` | `navActiveRef.current = navActive` during render. |
| 305 | `react-hooks/refs` | `bootstrapPendingRef.current = bootstrapPending` during render. |

---

### `src/hooks/use-recent-folders.ts` — 1 warning

| Line | Rule | Detail |
|------|------|--------|
| 63 | `react-hooks/set-state-in-effect` | `setItems(readRecentFolders(tier))` inside `useEffect`. |

---

### `src/hooks/use-recent-items.ts` — 1 warning

| Line | Rule | Detail |
|------|------|--------|
| 64 | `react-hooks/set-state-in-effect` | `setItems(readRecentItems(tier))` inside `useEffect`. |

---

## Fix strategy

These can be addressed incrementally. Recommended batches:

1. **Auto-fixable (3 warnings):** Run `pnpm run lint --fix` to remove stale `eslint-disable` comments in `ArchitecturalBottomDock.tsx` and `LoreLocationOrdoV7Slab.tsx`.

2. **Ref-sync pattern in ArchitecturalCanvasApp (39 warnings):** Extract a `useLatest(value)` hook and replace the ~20 top-level `ref.current = state` assignments at lines 3434–3458 with a single `useEffect`. Same pattern applies to the 3 ref-syncs in `VigilFlowRevealOverlay.tsx`.

3. **setState-in-effect across smaller components (15 warnings):** Review each site in `ArchitecturalLinksPanel`, `CommandPalette`, `GraphPanel`, `LoreAskPanel`, `use-recent-folders`, `use-recent-items`, and `EntityGraphLab`/`EntityGraphPillCanvas`. Most can be converted to initializer functions, `useSyncExternalStore`, or moved into subscription callbacks.

4. **setState-in-effect in ArchitecturalCanvasApp (32 warnings):** Largest batch, requires careful review. Many are legitimate async/subscription patterns that are correct but use a form the linter doesn't like.

5. **Purity / immutability (3 warnings):** Small, targeted fixes in `ArchitecturalCanvasApp`.
