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

- SAFE fixes can be applied after one batched approval prompt.
- RISKY fixes require explicit per-item approval.
- NET_NEW functionality always requires explicit approval.
- If there is uncertainty, stop and ask.

## 0. Inputs

- Audit path (from sentinel): `heartgarden/docs/REVIEW_YYYY-MM-DD_HHMM*.md`
- Scope to remediate: **all findings** in `CRITICAL/HIGH/MEDIUM/LOW`.
- Working directory for commands: `heartgarden/`

Use the remediation ledger and terminal-state rules from `.cursor/skills/review-common/CLOSURE_POLICY.md`.

## 1. Baseline Snapshot

Before changing code, capture baseline quality signals:

1. `npm run check`
2. `npm run test:unit`

Record pass/fail summary. Gate on **new** failures only.

## 2. Checkpoint

Create a checkpoint commit before remediation so rollback is deterministic:

- Commit message: `[auto] pre-fix checkpoint for review <date>`

Do not push.

## 3. Remediate to Full Closure (Do Not Stop Early)

Process findings in priority order (`CRITICAL` → `LOW`) and continue until every finding has a terminal state:

1. Classify each finding (`SAFE`, `RISKY`, `NET_NEW`).
2. Apply all `SAFE` fixes in logical batches; run targeted verification after each batch.
3. For each `RISKY` or `NET_NEW` finding, ask an explicit user question before editing. Include options, recommendation, and risk trade-offs.
4. If user approves, implement and verify; mark `FIXED`.
5. If user declines, mark `DECLINED_BY_USER`.
6. If ambiguity remains, keep `QUESTION_FOR_USER` open and ask follow-up until resolved.

Stop only when ledger shows terminal state for all findings.

## 4. Completion Contract

End the run with the closure report format required by `.cursor/skills/review-common/CLOSURE_POLICY.md`.
