---
name: deploy
description: >-
  Commits working-tree changes (optionally informed by recent agent chat
  context), pushes to git, ensures the result lands on origin main, and
  triggers or confirms Vercel production deployment. Use when the user invokes
  /deploy, or asks to commit everything from recent chats, push, merge to
  main, and deploy to Vercel.
---
# /deploy — ship to main and Vercel

Run this end-to-end in the **git repository root** (or the app root if the user’s workspace is only `heartgarden/` — detect with `git rev-parse --show-toplevel`).

**Paths in this file** are from the **monorepo root** (`…/Cursor/`). If your shell cwd is already **`heartgarden/`**, use **`docs/…`** where this file says **`heartgarden/docs/…`**, and **`AGENTS.md`** for **`heartgarden/AGENTS.md`**.

## 0. Preconditions

- Do **not** commit secrets: `.env`, `.env.local`, real API keys, or files ignored for good reason. If only `.env.local.example` or similar should change, stage those explicitly.
- If the user did not ask to commit **everything**, stop and confirm scope when the diff is large or mixes unrelated work.
- `/deploy` is explicit permission to commit, push, get the requested work onto the production branch, and verify Vercel. It is **not** permission to take unrelated one-way-door actions.
- Stop and ask before production data migrations/backfills, Vercel production env/auth/deployment-protection changes, force-pushes/history rewrites, closing/deleting PRs/branches, or expensive open-ended retries. Prefer the smallest reversible fix and report the risky next step.
- If Brett explicitly triggered deploy, keep the path fast: use best instincts and flag only critical errors, failed checks, deploy failures, or one-way-door risks.
- Collaboration policy: `heartgarden/docs/AGENT_COLLABORATION.md`. Brett-driven deploys should move quickly; Matt/external branches need explicit permission before merge/close/delete actions.
- Canonical onboarding and doc index: `heartgarden/AGENTS.md` (read order + **documentation update checklist** — use it when judging whether the **diff** is doc-complete before commit).

## 1. Inventory and optional chat context

1. `git status -sb` and review full diff (`git diff`, `git diff --staged`).
2. **“Changes from recent agent chats”** means: use the working tree as the source of truth; optionally read **the most recently modified** `*.jsonl` under the workspace’s agent transcripts folder (`.cursor/projects/<id>/agent-transcripts/`) only to phrase **commit messages** or **group files into logical commits**. Do not treat transcripts as authoritative over `git status`.
3. **Docs and env hygiene (from the diff):** If the change touches `app/api/**` contracts, user-visible behavior, primary file locations, new/retired open engineering work, shipped tranches, or **env var semantics/keys**, the matching updates should appear in the **same** commit series per **`heartgarden/AGENTS.md`** checklist (typically `heartgarden/docs/API.md`, `heartgarden/docs/FEATURES.md`, `heartgarden/docs/CODEMAP.md`, `heartgarden/docs/BACKLOG.md` / `heartgarden/docs/BUILD_PLAN.md`, and **`heartgarden/docs/VERCEL_ENV_VARS.md`** for env matrix SoT). If docs are intentionally deferred, say so in the reply (brief). Do not duplicate the full env matrix in narrative docs; link **`VERCEL_ENV_VARS.md`**.
4. **Schema / Neon:** If the diff adds or depends on new DB schema, do not assume deploy alone applies migrations. Follow **`heartgarden/docs/NEON_VERCEL_SETUP.md`** and project db scripts so Production (and any Preview target) is migrated **before** or **with** the code that needs it; otherwise flag the gap instead of a silent `Deployed.`.

## 2. Commit strategy

- Prefer **several focused commits** when the diff clearly splits (e.g. docs vs app vs CI). Otherwise **one** clear commit is fine.
- Message style: imperative, specific; reference area (`heartgarden:`, `docs:`, etc.) if helpful.
- Stage with intent (`git add -p` or path-scoped `git add` when splitting commits).

## 3. Push and get onto `origin/main`

1. Note current branch: `git branch --show-current`.
2. **Already on `main` or `master` (tracking `origin`):** `git pull --rebase` (or merge if that’s the repo norm), then `git push origin <branch>`.
3. **On a feature branch:**
   - `git fetch origin`.
   - Fast-forward local main if possible: `git checkout main` (or `master`), `git pull origin main`.
   - `git merge <feature-branch>` (or `git rebase` only if the user/repo consistently uses rebase — default to **merge** for shared main unless you know otherwise).
   - Resolve conflicts carefully; run quick checks if the project documents them (e.g. `pnpm run check` from `heartgarden/` for heartgarden).
   - `git push origin main`.
4. **Never** `git push --force` to `main`/`master` without **explicit** user instruction.
5. If the team uses **PR-only** flow: push the feature branch, open/merge the PR via GitHub/GitLab UI (or `gh pr merge` if available and the user expects it), then ensure `origin/main` contains the merge result before treating deploy as done.

## 4. Vercel deployment

**Git integration (typical):** Pushing to `main` triggers a production deployment automatically. Confirm in Vercel → Deployments, or with `vercel ls` / project dashboard if CLI is linked. **New or changed Vercel env values** in the dashboard require a **redeploy** for serverless to pick them up; align changes with **`heartgarden/docs/VERCEL_ENV_VARS.md`**. First-time / narrative order: **`heartgarden/docs/DEPLOY_VERCEL.md`**.

**CLI (when the user wants an explicit deploy or git hook isn’t wired):**

- From repo root, respect **Root Directory** in the Vercel project (e.g. heartgarden: **`heartgarden/`**):  
  `cd heartgarden` (or the configured app directory), then `vercel --prod`  
  Requires prior `vercel login` and `vercel link` for that directory. **`heartgarden/docs/GO_LIVE_REMAINING.md`** (CLI habit: monorepo root vs Root Directory `heartgarden`).

If deploy fails, capture the build error, fix **only** what’s needed, commit, push to `main`, and retry or redeploy.

## 5. Done criteria

- Working tree clean (or only intentional leftovers explained to the user).
- Latest commits are on **`origin/main`** (or the repo’s default production branch).
- Production deployment **succeeded** or is **in progress** on Vercel with a clear way for the user to verify.

## 6. Reply to the user (required)

Keep the final message **minimal**.

- **Everything completed normally** (pushed to `origin/main`, production deploy succeeded or finished **Ready**, no surprises): reply with exactly **`Deployed.`** — that single word plus the period, no URLs, headings, or bullet lists in that reply.
- **Any failure or incomplete step** (push rejected, merge aborted, checks failed, Vercel **Error**, could not verify deploy): **do not** say `Deployed.`; reply with a **short** plain explanation of what broke and what is still blocked.
- **Atypical but still shipped** (e.g. production still **Building** when you last checked, resolved merge conflicts, skipped paths the user should know about, secrets scan noise, PR required so `main` not updated): put **one short line** with the flag first, then a second line with exactly **`Deployed.`** only if code is on `origin/main` and you believe production will be OK; if deploy is uncertain or failed, omit `Deployed.` and explain.
