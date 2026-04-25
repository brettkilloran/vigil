# Bugbot review notes — vigil / heartgarden

Project-specific guidance for Cursor Bugbot when reviewing PRs against this repo.
The canonical agent doc is `heartgarden/AGENTS.md`; this file is a short, review-focused projection of it.

## Read order before flagging anything

1. `heartgarden/AGENTS.md` — onboarding + architecture reality
2. `heartgarden/docs/API.md` — HTTP routes
3. `heartgarden/docs/FEATURES.md` — shipped behavior → code
4. `heartgarden/docs/CODEMAP.md` — subsystem → files
5. `heartgarden/docs/BACKLOG.md` — open engineering work (SOT)

If a PR touches behavior covered by one of those docs and the doc isn't updated, mention it.

## Repo conventions worth enforcing

- **Package manager:** `heartgarden/` is **pnpm only**. Once `mise.toml` is on `main`, flag any *new* `npm` / `yarn` invocations in `heartgarden/` code, scripts, CI, or docs. Pre-existing legacy references in untouched files are fine.
- **Naming:** the product is **heartgarden**; the folder is **`heartgarden/`**. The stable user-facing link scheme is `vigil:*`. Don't propose renaming `vigil:*` link targets, CSS tokens, or localStorage keys — those are intentionally stable per `heartgarden/docs/NAMING.md`.
- **Comments:** the repo's Cursor rules ban narrating comments (e.g. `// increment counter`, `// import the module`). Flag obvious narration introduced in a diff. Comments that explain *why* (trade-offs, constraints, gotchas) are fine and encouraged.
- **CSS modules:** `*.module.css` files must not contain `:root { ... }` selectors — module scoping breaks them silently. Globals belong in `app/globals.css`.
- **No Turbopack in dev:** `next dev --webpack` is the supported local script (`pnpm run dev`). If a PR adds `--turbo` to dev/build, flag it.

## Subsystems to be careful with

- **API boot gate:** `heartgarden/proxy.ts` returns **403** for `/api/*` without `hg_boot` cookie (or MCP Bearer allowlist). Allowlisted paths include `/api/heartgarden/boot` and `/api/mcp`. Never weaken or bypass this on production paths. New API routes default to gated.
- **Demo seed fallback:** `applyDemoLocalCanvas` in `ArchitecturalCanvasApp.tsx` is the offline / Playwright fallback. Don't break it. Tests under `e2e/` rely on `PLAYWRIGHT_E2E=1` taking that path.
- **Canvas camera:** the shell **writes** but does **not read** stored pan on bootstrap / enterSpace; this is intentional so stale offsets don't override the centered landing (`src/lib/heartgarden-space-camera.ts`, `defaultCamera` in `src/model/canvas-types.ts`). If a PR adds a read-on-bootstrap path, flag it.
- **Vault index orchestration:** the `after()` server hook (`HEARTGARDEN_INDEX_AFTER_PATCH`) runs with `refreshLoreMeta: false`; the debounced client `POST /api/items/:id/index` refreshes meta. Don't double-up Anthropic lore-meta calls. See AGENTS.md "Lore + vault index".
- **Foundation ↔ product-ui sync:** components used by both the running shell and Storybook live under `heartgarden/src/components/foundation/` *and / or* `heartgarden/src/components/product-ui/`. Moves between those trees must update Storybook story paths *and* the foundation-sync verifier (`heartgarden/scripts/verify-foundation-sync.mjs`) in the same PR. Story-path drift here has bitten CI before.
- **Visual regression baselines:** snapshots under `heartgarden/e2e/visual/` are OS-specific. Do not regenerate Linux baselines from a Windows checkout (and vice versa).

## Doc-update checklist (cite when missing)

When code changes touch these surfaces, the matching doc must be updated in the same PR:

| Change | Required doc |
|---|---|
| New / renamed / removed `app/api/**` route, or new env requirement on a route | `heartgarden/docs/API.md` |
| User-visible behavior change | `heartgarden/docs/FEATURES.md` |
| New file location for a major subsystem | `heartgarden/docs/CODEMAP.md` |
| New env var (any service) | `heartgarden/docs/VERCEL_ENV_VARS.md` |
| Open work added / retired | `heartgarden/docs/BACKLOG.md` (SOT for open work) |
| Work shipped | `heartgarden/docs/BUILD_PLAN.md` Completed-tranches table |

## What *not* to flag

- Large PRs with broad rename / migration scope are normal here (e.g. dev-env migrations, naming sweeps). Don't gate purely on size.
- The legacy folder name `heartgarden/app/_components/VigilApp.tsx` is intentionally not renamed — the file name is historical, the contents are the heartgarden shell.
- `vigil:*` strings (links, CSS tokens, localStorage keys, MCP tool aliases) are stable contracts. Renames are out of scope.
- TODO / FIXME comments referencing an issue id (e.g. `TODO(#123): ...`) are tracked work, not lint targets.

## Quick reproduction hints (for "is this real?" checks)

- Local verification: `cd heartgarden && pnpm run check` (lint + build). On `main` before the migration lands, `npm run check`.
- Smoke surfaces: `pnpm run dev:surfaces` runs the app on `:3000` and Storybook on `127.0.0.1:6006`.
- E2E gate: Playwright suite expects `PLAYWRIGHT_E2E=1` and runs against the demo canvas fallback.
