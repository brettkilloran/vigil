# Review Closure Policy (Shared)

Use this policy for both `/review-heavy` and `/review-light`.

## Goal

Drive the review run to **full closure** for every finding in `CRITICAL/HIGH/MEDIUM/LOW`.

## Required Terminal State Per Finding

Each finding must end in exactly one terminal state:

- `FIXED`: implemented and verified.
- `QUESTION_FOR_USER`: blocked on risky/unclear choice and explicitly asked to user.
- `DECLINED_BY_USER`: user explicitly chose not to apply the fix.

No silent deferrals. No unclassified leftovers.

## Classifier Contract

- `SAFE`: minimal bug fix, no feature expansion, no new route/dependency/env var/migration/public API change.
- `RISKY`: touches sensitive boundaries or carries meaningful regression potential.
- `NET_NEW`: adds capability/functionality beyond correcting the audited issue.

Approval rules:

- `SAFE`: may proceed after one batched approval prompt.
- `RISKY`: explicit user approval required before edits.
- `NET_NEW`: explicit user approval required before edits.

## Remediation Ledger (Required)

Track each finding with:

- finding id/title
- severity
- classifier (`SAFE`/`RISKY`/`NET_NEW`)
- state (`FIXED`/`QUESTION_FOR_USER`/`DECLINED_BY_USER`)
- verification note

## QUESTION_FOR_USER Template Requirements

When blocked, ask a direct question including:

- what is risky or unclear
- options (2+ when possible)
- recommended option
- risk/impact summary for options

## Completion Contract

Finish with a compact closure report containing:

- counts by terminal state
- files changed
- verification commands and outcomes
- explicit outstanding user questions (if any)
