---
title: heartgarden - human and agent collaboration guide
status: canonical
audience: [agent, human]
last_reviewed: 2026-04-25
canonical: true
related:
  - ../AGENTS.md
  - ../../.cursor/BUGBOT.md
  - ../../.cursor/rules/heartgarden-collaboration.mdc
---

# heartgarden - human and agent collaboration guide

This is the operating agreement for Brett, Matt, local Cursor agents, Cursor Cloud Agents, Bugbot, and future repo assistants. It turns repeated workflow preferences into a durable harness so agents can move quickly without surprising the humans.

## Sources and stance

This guide follows current guidance from Cursor's agent best-practices docs, GitHub Copilot best practices, Bugbot / Cloud Agent docs, and the "humans on the loop" framing from Thoughtworks / Martin Fowler. The practical translation for heartgarden:

- Humans own product intent, trust boundaries, and final accountability.
- Agents own investigation, implementation, verification, and crisp status reporting when the task is safe and clear.
- Repeated mistakes should become better rules, docs, checks, or skills. Do not rely on chat memory for durable workflow policy.

Reference links:

- Cursor: [Best practices for coding with agents](https://cursor.com/blog/agent-best-practices)
- Cursor docs: [Rules](https://cursor.com/docs/rules), [Agent Skills](https://cursor.com/docs/skills), [Bugbot](https://cursor.com/docs/bugbot), [Cloud Agents](https://cursor.com/docs/cloud-agent)
- GitHub: [Best practices for using GitHub Copilot](https://docs.github.com/en/copilot/get-started/best-practices)
- Thoughtworks / Martin Fowler: [Humans and Agents in Software Engineering Loops](https://martinfowler.com/articles/exploring-gen-ai/humans-and-agents.html)

## People and authority

**Brett** is the product owner and primary operator. When Brett directly asks a Cursor agent to do something in this repo, bias toward action, not process. Do the work, verify it, and report anything risky or blocked.

**Matt** is a trusted external collaborator and high-signal reviewer. Treat Matt's comments as serious peer-review input, not as commands that override repo evidence. If Matt suggests a narrow, reversible fix and the code confirms it, act. If Matt's suggestion changes ownership, closes/merges work, touches production, or conflicts with evidence, explain the evidence and ask Brett before the disruptive step.

**Agents** are collaborators, not owners. Be confident when evidence supports confidence. Be explicit when you are guessing, blocked, missing credentials, or crossing a boundary.

## Autonomy model

Agents may proceed without another question when all of these are true:

- The task is clear from Brett's request or an unambiguous GitHub comment.
- The action is local, reversible, or additive: code edits, docs edits, tests, opening PRs, leaving status comments, or adding follow-up issues/notes.
- The agent has inspected current repo state and protected unrelated dirty work.
- There is a clear verification path, or the agent can explain why verification is unavailable.

Agents must ask Brett before:

- Merging PRs, closing PRs/issues, deleting branches, or marking another human's work obsolete.
- Force-pushing, rewriting shared history, rebasing a branch owned by someone else, or running destructive git commands.
- Touching production data, production DB migrations, Vercel production env vars, deploy protection, auth, secrets, billing, or tokens.
- Starting expensive or open-ended agent loops, broad dependency upgrades, or high-token research runs without a bounded goal.
- Taking action where the rollback is unclear or the blast radius includes Matt's branch/workflow.

Agents may always ask questions when requirements are unclear. No question is too silly if it prevents a bad assumption, but do not use questions to avoid safe, obvious work.

## GitHub workflow

Before acting on GitHub comments:

1. Read the current PR/issue state, recent comments, checks, branch names, and whether the branch belongs to Brett, Matt, or an agent.
2. Turn comments into action items with an owner: Brett, Matt, agent, or no action.
3. Separate unrelated repo-maintenance work into a separate PR unless Brett or Matt explicitly wants it on the current branch.
4. Prefer evidence over vibes: reproduce failures, inspect annotations/logs, and cite commands run.

Default PR policy:

- For Brett-driven Cursor work, agents can open and update PRs without blocking on PR size. Coherence and green checks matter more than arbitrary diff size.
- For agent-created PRs, use clear titles and bodies with summary, verification, and known risks. Draft is fine while checks are unknown; ready-for-review is fine once scope is coherent and checks are green.
- Do not merge unless Brett explicitly asks, or a deploy skill / repo process explicitly authorizes it.
- Do not push directly to Matt's branch unless Matt or Brett explicitly asks. Prefer a separate branch/PR for unrelated fixes.

GitHub comment style:

- Be professional, clear, and concise.
- Always identify the responding agent/model at the top of GitHub comments, even when posting through Brett's personal GitHub handle. Prefer a compact "for Brett" signature, e.g. "GPT-5.5 for Brett here."
- Say what changed, what was verified, and what remains blocked.
- Sound confident only when evidence supports it. If help or guidance is needed, say so directly.
- Avoid noisy play-by-play. Comment when taking ownership, handing off, blocked, or finished.
- Tune depth to the reader: Matt can get principal-engineer-level backend/full-stack detail; Brett should get product-designer-friendly framing, with metaphors or plain-English summaries before jargon.

## Cursor workflow

Start with context:

- Check git status before edits. Assume dirty files may be Brett's, Matt's, or another agent's work.
- Read the local docs/rules before broad changes: `AGENTS.md`, this file, `docs/CODEMAP.md`, `docs/API.md`, `docs/BACKLOG.md`, and relevant `.cursor/rules/*`.
- Use Plan Mode or ask questions for ambiguous architecture, production risk, or multi-system work. For small obvious fixes, act.

During work:

- Keep edits scoped to the requested behavior and current branch.
- Prefer tests/checks that match risk: `pnpm run verify:foundation-sync`, `pnpm run lint`, `pnpm run check`, `pnpm run check:all`, targeted unit/e2e, or manual browser validation.
- Update docs when behavior, API shape, env vars, major file locations, or backlog state changes.
- If an agent repeats a mistake, improve the harness: rules, `AGENTS.md`, Bugbot notes, skills, scripts, or tests.
- Ask before expensive API/token/build work or long-running open-ended loops unless Brett explicitly triggered the workflow and the work is clearly necessary.

Handoff:

- Final reports should be short and useful: changed files/behavior, verification, GitHub status, blockers, and anything Brett/Matt must decide.
- Do not bury missing credentials, skipped tests, failed checks, or unpushed local changes.
- When blocked by auth, missing access, or missing context, ask Brett with 2-3 concrete options and a recommendation.

## Safety defaults

High-confidence, low-risk work should move fast. One-way doors should pause.

Protected by default:

- Secrets and auth material.
- Production data and migrations.
- Deployment protection, production env vars, and billing/cost controls.
- Destructive git and history rewrites.
- Merge/close/delete actions on GitHub.

Before recommending merge/deploy for production-affecting changes, prefer: relevant local checks, CI green, manual smoke for user-facing flows, human review from Brett or Matt, and a short rollback note. If Brett explicitly triggers deploy, use best instincts and do not slow the path with routine caveats; flag true critical errors, failed checks, deploy failures, or one-way-door risks.

When in doubt, present the smallest reversible next step and ask for approval on the irreversible one.
