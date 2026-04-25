---
name: review-heavy-fix-pass
description: >-
  Applies follow-up fixes from a /review-heavy audit using Codex subagents with
  strict fail-closed safety gates. Automatically fixes SAFE findings, but pauses
  for explicit user approval on RISKY or NET_NEW changes.
---
# Fix Pass for /review-heavy

Use this playbook after `/review-heavy` writes an audit file.
Also read and follow `.cursor/skills/review-common/CLOSURE_POLICY.md`.

## Core Policy

- SAFE fixes are auto-applied without asking, then listed in the closure report.
- RISKY and NET_NEW fixes require explicit user approval via the `AskQuestion` tool, with pros/cons and a plain-language preamble.
- Batch related RISKY/NET_NEW questions (default by severity, 3–6 per batch). Use a single-question `AskQuestion` call for very risky items (auth, destructive migrations, billing, public API breaks).
- If there is uncertainty about whether something is SAFE, treat it as RISKY and ask.

See `.cursor/skills/review-common/CLOSURE_POLICY.md` "Questions Phase" for the full format.

## 0. Inputs

- Audit path (from sentinel): `heartgarden/docs/REVIEW_YYYY-MM-DD_HHMM*.md`
- Scope to remediate: **all findings** in `CRITICAL/HIGH/MEDIUM/LOW`.
- Working directory for commands: `heartgarden/`

Use the remediation ledger and terminal-state rules from `.cursor/skills/review-common/CLOSURE_POLICY.md`.

## 1. Baseline Snapshot

Before changing code, capture baseline quality signals:

1. `pnpm run check`
2. `pnpm run test:unit`

Record pass/fail summary. Gate on **new** failures only.

## 2. Checkpoint

Create a checkpoint commit before remediation so rollback is deterministic:

- Commit message: `[auto] pre-fix checkpoint for review <date>`

Do not push.

## 3. Prior-Review Dedupe

Before classifying or asking, follow `.cursor/skills/review-common/CLOSURE_POLICY.md` → "Prior-Review Deduplication". Silently drop previously declined findings and raise severity on regressions before proceeding.

## 4. Remediate to Full Closure (Do Not Stop Early)

Process findings in priority order (`CRITICAL` → `LOW`) and continue until every finding has a terminal state:

1. Classify each finding (`SAFE`, `RISKY`, `NET_NEW`). Respect the always-RISKY categories in the closure policy (auth, migrations, billing, realtime/sync, public API, MCP).
2. Auto-apply all `SAFE` fixes in logical batches without prompting. After each batch, run the **post-fix verification gate** from the closure policy (`pnpm run check`, `pnpm run test:unit`, diff against baseline). On new failures, make up to 2 targeted repairs; if still failing, roll that fix back to the checkpoint and reclassify as `QUESTION_FOR_USER`.
3. Apply the **stuck-state escalation rule**: if a SAFE fix takes more than 2 attempts or reveals hidden complexity, reclassify as RISKY and ask.
4. For remaining `NET_NEW` findings, check the **feature-overflow rule** (>~5 files, new subsystem, or feature-sized work). If overflow, file a backlog entry in `heartgarden/docs/BACKLOG.md` under `## Review-sourced backlog` per the closure policy and mark `DECLINED_BY_USER` with a note. Do not ask the user a yes/no.
5. Group the remaining `RISKY` and `NET_NEW` findings into sensible batches (default: by severity, 3–6 questions per batch). Very risky items (auth bypass, destructive migrations, billing, public API breaks, irreversible destructive changes) get their own single-question `AskQuestion` call.
6. For each batch, emit a plain-language preamble, then call `AskQuestion` with multiple-choice questions including pros/cons and a clear recommendation. Never ask risky questions as free-form prose.
7. If user approves, implement and verify (post-fix gate applies); mark `FIXED`.
8. If user declines, mark `DECLINED_BY_USER`.
9. If ambiguity remains after an answer, follow up with another `AskQuestion` call until resolved.

Stop only when ledger shows terminal state for all findings.

## 5. UI Verification (if applicable)

For fixes touching visible UI, run the **UI Fix Verification** procedure in the closure policy (cursor-ide-browser MCP before/after screenshots against `http://localhost:3000`). Record screenshot paths in the ledger.

## 6. Completion Contract

End the run with the closure report format required by `.cursor/skills/review-common/CLOSURE_POLICY.md`, including the Next Session Ideas, Deduped, and Filed to Backlog sections.
