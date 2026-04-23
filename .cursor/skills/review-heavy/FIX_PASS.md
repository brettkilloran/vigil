---
name: review-heavy-fix-pass
description: >-
  Applies follow-up fixes from a /review-heavy audit using Codex subagents with
  strict fail-closed safety gates. Automatically fixes SAFE findings, but pauses
  for explicit user approval on RISKY or NET_NEW changes.
---
# Fix Pass for /review-heavy

Use this playbook after `/review-heavy` writes an audit file.

## Core Policy

- SAFE fixes can be applied after one batched approval prompt.
- RISKY fixes require explicit per-item approval.
- NET_NEW functionality always requires explicit approval.
- If there is uncertainty, stop and ask.

## 0. Inputs

- Audit path (from sentinel): `heartgarden/docs/REVIEW_YYYY-MM-DD_HHMM*.md`
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
