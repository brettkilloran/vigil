# heartgarden — release version

## Source of truth

- **Semver** lives in the app root **`package.json`** → `version` (currently the product line **0.9.x** on the road to 1.0).
- Runtime imports use **`src/lib/app-version.ts`**:
  - **`HEARTGARDEN_APP_VERSION`** — semver only.
  - **`HEARTGARDEN_APP_VERSION_LABEL`** — semver plus optional build suffix **`+` + first 7 hex chars of the deploy commit** on Vercel when `VERCEL_GIT_COMMIT_SHA` is present (wired via `next.config.ts` → `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`).

## Bumping the version (human / release)

From **`heartgarden/`**:

| Goal | Command |
|------|---------|
| Patch (fixes, small changes) | `pnpm run release:patch` |
| Minor (features, backward compatible) | `pnpm run release:minor` |
| Major (breaking) | `pnpm run release:major` |

These run **`pnpm version`**, which updates `package.json` (the lockfile is regenerated on the next install) and, when appropriate, creates a git tag (depends on your pnpm/git config and repo root).

## Progress vs automation

- **Product progress** is still tracked in **`docs/BUILD_PLAN.md`** and the Cursor lore-engine plan; those do not auto-bump semver.
- **Deploy uniqueness** does not require a semver bump: each Vercel production build gets a distinct **`HEARTGARDEN_APP_VERSION_LABEL`** via the git SHA suffix.
- Later optional steps: tag-driven CI that runs `pnpm version` from tags, or conventional-commit tooling — not required for the current setup.
