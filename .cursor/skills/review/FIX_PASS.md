---
name: review-fix-pass
description: >-
  Applies follow-up fixes from a /review audit using Codex subagents with strict
  fail-closed safety gates. Automatically fixes SAFE findings, but pauses for
  explicit user approval on RISKY or NET_NEW changes.
---
# Fix Pass for /review

Use this playbook after `/review` writes an audit file.

## Core Policy

- SAFE fixes can be applied after one batched approval prompt.
- RISKY fixes require explicit per-item approval.
- NET_NEW functionality always requires explicit approval.
- If there is uncertainty, stop and ask.

## 0. Inputs

- Audit path (from sentinel): `heartgarden/docs/REVIEW_YYYY-MM-DD*.md`
- Scope to remediate: default `CRITICAL` + `HIGH` only.
- Working directory for commands: `heartgarden/`

## 1. Baseline Snapshot

Before changing code, capture baseline quality signals:

1. `npm run check`
2. `npm run test:unit`

Record pass/fail summary. Gate on **new** failures only.

## 2. Checkpoint

Create a checkpoint commit before remediation so rollback is deterministic:

- Commit message: `[auto] pre-fix checkpoint for review <date>`

Do not push.

## 3. Classifier Subagent (Codex, Read-Only)

Spawn a fresh Codex subagent and classify each CRITICAL/HIGH item into:

- `SAFE`
- `RISKY`
- `NET_NEW`

### Classifier Heuristics

`SAFE` examples:
- localized bug fix with no behavior expansion
- no new endpoints/dependencies/env vars/migrations/public API changes
- limited blast radius and clear direct correction

`RISKY` examples:
- touches auth/boot/proxy/realtime/core sync boundaries
- schema shape changes, migration needs, contract shifts
- broad refactors or large edits with uncertain behavior impact

`NET_NEW` examples:
- introduces user-visible functionality
- adds new route/tool/workflow or capability not needed to resolve the finding

Return a table: finding ID, label, justification.

## 4. Approval Gate

Ask once in a batched prompt:

- Confirm all `SAFE` items may proceed automatically.
- Request explicit yes/no for each `RISKY` and `NET_NEW` item.

If user does not approve an item, mark it `HELD`.

## 5. Fixer Subagent (Codex, Fresh Context Per Item)

For each approved item:

- Spawn a fresh Codex fixer subagent.
- Instruct it to fix only that item.
- Forbid adjacent refactors and feature expansion.
- Prefer minimal diff.

## 6. Independent Verifier Subagent (Codex, Fresh Context)

After each fix, spawn a separate Codex verifier subagent with only:

- the specific finding text
- the fix diff
- product-goal context from `heartgarden/AGENTS.md`, `heartgarden/docs/STRATEGY.md`, `heartgarden/docs/FEATURES.md`

Verifier must return structured JSON:

```json
{
  "resolvesFinding": true,
  "addsNetNewFunctionality": false,
  "regressionRisk": "none",
  "driftsFromProductGoal": false,
  "publicApiChanged": false,
  "migrationRequired": false,
  "confidence": 0.9,
  "rationale": "brief explanation"
}
```

### Fail-Closed Conditions

Rollback/escalate immediately if any are true:

- `addsNetNewFunctionality = true`
- `driftsFromProductGoal = true`
- `regressionRisk = medium|high`
- `publicApiChanged = true` (unless user explicitly approved)
- `migrationRequired = true` (unless user explicitly approved)
- verifier output cannot be parsed

## 7. Baseline-Relative Gates After Each Fix

Re-run:

- `npm run check`
- `npm run test:unit` (mandatory when touching `app/api/**` or `src/lib/**`)

If there are new failures compared to baseline:

- rollback to checkpoint for that attempt
- mark item `HELD`
- escalate to user

## 8. Retry Cap

- Max 2 fix attempts per item.
- Attempt 2 can use verifier feedback.
- If still failing, stop and mark item `HELD`.

## 9. Commit Convention

For each verified, gated fix:

- one focused commit per item when practical
- message: `review fix #<id>: <short finding title>`
- no amend unless explicitly requested
- never force-push

## 10. Final Report

Return a remediation table:

- `FIXED` (commit sha)
- `HELD` (requires decision / failed gates)
- `SKIPPED` (not approved)

Append this table to the audit file under `## Remediation log`.

## 11. Non-Goals

- Do not open PRs automatically.
- Do not push automatically.
- Do not deploy automatically.
