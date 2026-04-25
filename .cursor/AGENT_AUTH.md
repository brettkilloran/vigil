# Agent auth — read this first

This repo's owner is on Windows, uses Cursor + GitHub CLI, and finds
auth popups disruptive. Honor that.

## For ANY GitHub operation (PRs, comments, CI logs, releases, repo state)

Use `gh` first. It's at `C:\Program Files\GitHub CLI\gh.exe`, already
authenticated as `brettkilloran` via Windows keyring (token stored
under `gh:github.com:*` in Credential Manager). Token scopes:
`gist, read:org, repo`.

- ✅ `gh pr comment`, `gh pr create`, `gh pr view`, `gh pr list`
- ✅ `gh run view --log` and `--log-failed` for CI debugging
- ✅ `gh api /repos/...` for anything `gh` doesn't expose directly
- ❌ Don't write raw `Invoke-RestMethod` to GitHub unless `gh` truly
  cannot do the thing.
- ❌ Don't run `gh auth login` again — already done. If a scope is
  missing, run `gh auth refresh -s <scope>` and tell the user there
  will be ONE browser popup.

## For git push/fetch/clone

`git` reads the same token via Git Credential Manager (system-scope
`credential.helper=manager`). No setup needed.

## For app secrets the running app needs (Anthropic, OpenAI, Neon, etc.)

Those live in `heartgarden/.env.local` (gitignored, see
`heartgarden/.env.local.example` for keys) and in Cursor's Cloud Agent
Secrets tab for `@cursor` PR runs. Never put them in process env vars
or in-repo config.

## What never to do

- Never invent or generate a token.
- Never echo a token value to chat output, even partially. Describe by
  prefix only (`gho_`, `ghp_`, `github_pat_`).
- Never commit `.env*` files (other than `.env.local.example`).
- Never run `--no-verify` on commits unless the user explicitly says
  so. The repo's pre-commit hook honors `SKIP_SECRET_HOOK=1` for
  legitimate cases (worktrees without `node_modules`, etc.).

## PowerShell pitfalls when shelling out to `gh`

The owner's shell is PowerShell. `gh`'s `--jq` flag uses jq syntax
that PowerShell mangles (parens, slashes, `\(.field)` interpolation).
Two safe patterns:

- Use `--template` (Go templates) instead of `--jq` when shaping
  output for human display.
- Use `--json <fields>` and pipe to `ConvertFrom-Json` in PowerShell
  for structured access.

Avoid `--jq` with complex expressions in inline PowerShell unless
you wrap the whole `gh` invocation in `cmd /c "..."`.

## Cursor-side surfaces (browser-only, can't be done from agent shell)

These three live at `cursor.com/dashboard/*` and require an
authenticated browser session. The agent cannot install GitHub Apps,
toggle Bugbot, or set Cloud Agent secrets via API on Individual plans:

- GitHub App install: `cursor.com/dashboard/integrations`
- Bugbot per-repo toggle: `cursor.com/dashboard/bugbot`
- Cloud Agent secrets + spend limit: `cursor.com/dashboard/cloud-agents`

If the user wants the agent to drive these, they can hand off a
persistent `cursor-ide-browser` MCP session (one-time login, cookies
persist across agent runs). Otherwise: give them the URL and a
checklist; don't pretend it can be automated.
