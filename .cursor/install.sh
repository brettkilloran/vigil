#!/usr/bin/env bash
# Cursor Cloud Agent bootstrap for the vigil / heartgarden repo.
#
# Mirrors the local dev workflow from `heartgarden/AGENTS.md`:
#   - Node version pinned via mise.toml (when present)
#   - pnpm activated via corepack inside mise's postinstall hook
#   - heartgarden/ deps installed lockfile-strict
#
# This script is intentionally idempotent: Cursor caches the resulting VM
# state as a snapshot, but may re-run install on dependency churn.

set -euo pipefail

if [ -f mise.toml ]; then
  # Post-migration world (mise + pnpm). This is the steady state once
  # the dev-environment migration PR lands on main.
  if [ ! -x "$HOME/.local/bin/mise" ]; then
    curl -fsSL https://mise.run | sh
  fi
  export PATH="$HOME/.local/share/mise/shims:$HOME/.local/bin:$PATH"

  mise trust --yes
  mise install

  cd heartgarden
  pnpm install --frozen-lockfile
else
  # Pre-migration fallback (current main, npm + package-lock.json).
  # Delete this branch once mise.toml is on main.
  cd heartgarden
  if ! command -v npm >/dev/null 2>&1; then
    echo "npm not on PATH; Cursor's Ubuntu base image is expected to provide Node + npm." >&2
    exit 1
  fi
  npm ci
fi
