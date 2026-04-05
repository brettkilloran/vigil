---
name: deploy
description: >-
  Commits working-tree changes (optionally informed by recent agent chat
  context), pushes to git, ensures the result lands on origin main, and
  triggers or confirms Vercel production deployment. Use when the user invokes
  /deploy, or asks to commit everything from recent chats, push, merge to
  main, and deploy to Vercel. Lives in-repo at .cursor/skills/deploy/.
---
# /deploy — ship to main and Vercel

Run this end-to-end in the **git repository root** (or the app root if the user’s workspace is only `vigil/` — detect with `git rev-parse --show-toplevel`).

## 0. Preconditions

- Do **not** commit secrets: `.env`, `.env.local`, real API keys, or files ignored for good reason. If only `.env.local.example` or similar should change, stage those explicitly.
- If the user did not ask to commit **everything**, stop and confirm scope when the diff is large or mixes unrelated work.

## 1. Inventory and optional chat context

1. `git status -sb` and review full diff (`git diff`, `git diff --staged`).
2. **“Changes from recent agent chats”** means: use the working tree as the source of truth; optionally read **the most recently modified** `*.jsonl` under the workspace’s agent transcripts folder (`.cursor/projects/<id>/agent-transcripts/`) only to phrase **commit messages** or **group files into logical commits**. Do not treat transcripts as authoritative over `git status`.

## 2. Commit strategy

- Prefer **several focused commits** when the diff clearly splits (e.g. docs vs app vs CI). Otherwise **one** clear commit is fine.
- Message style: imperative, specific; reference area (`vigil:`, `docs:`, etc.) if helpful.
- Stage with intent (`git add -p` or path-scoped `git add` when splitting commits).

## 3. Push and get onto `origin/main`

1. Note current branch: `git branch --show-current`.
2. **Already on `main` or `master` (tracking `origin`):** `git pull --rebase` (or merge if that’s the repo norm), then `git push origin <branch>`.
3. **On a feature branch:**
   - `git fetch origin`.
   - Fast-forward local main if possible: `git checkout main` (or `master`), `git pull origin main`.
   - `git merge <feature-branch>` (or `git rebase` only if the user/repo consistently uses rebase — default to **merge** for shared main unless you know otherwise).
   - Resolve conflicts carefully; run quick checks if the project documents them (e.g. `npm run check` from `vigil/` for heartgarden).
   - `git push origin main`.
4. **Never** `git push --force` to `main`/`master` without **explicit** user instruction.
5. If the team uses **PR-only** flow: push the feature branch, open/merge the PR via GitHub/GitLab UI (or `gh pr merge` if available and the user expects it), then ensure `origin/main` contains the merge result before treating deploy as done.

## 4. Vercel deployment

**Git integration (typical):** Pushing to `main` triggers a production deployment automatically. Confirm in Vercel → Deployments, or with `vercel ls` / project dashboard if CLI is linked.

**CLI (when the user wants an explicit deploy or git hook isn’t wired):**

- From repo root, respect **Root Directory** in the Vercel project (e.g. heartgarden: **`vigil/`**):  
  `cd vigil` (or the configured app directory), then `vercel --prod`  
  Requires prior `vercel login` and `vercel link` for that directory.

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
