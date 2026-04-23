---
name: review-light
description: >-
  Runs a cheaper, faster code review using a single Composer 2 subagent pass and
  returns high-signal findings with file evidence. Writes
  heartgarden/docs/REVIEW_YYYY-MM-DD_HHMM.md (UTC date and 24h time). Use when
  the user invokes /review-light, wants a low-cost review, or needs a quick
  pre-commit sanity check.
---
# /review-light

Use this for low-cost review. Prefer `review-heavy` when the change is large, risky, or release-bound.

## 0. Cost-Constrained Mode

- Run exactly one review subagent pass.
- Use `subagent_type: generalPurpose`, `readonly: true`.
- Use model `composer-2-fast`.
- Do not run multi-agent fan-out.
- Write a dated audit file every run so fix-pass can execute deterministically.

## 1. Scope Detection (Smart Auto)

1. If user gave scope, use it.
2. Else if working tree is dirty, review uncommitted diff + untracked files.
3. Else if feature branch and `origin/main` exists, review `origin/main...HEAD`.
4. Else review `HEAD`.

## 2. Review Focus (High-Signal Only)

Limit to up to 8 findings total, prioritized by risk:

1. correctness regressions
2. security/auth/data-integrity issues
3. performance hot-path risks
4. documentation/contract drift that can mislead future work

Skip style-only nits unless they hide a real bug.

## 3. Output Format

- `CRITICAL/HIGH/MEDIUM/LOW` buckets
- Each finding includes:
  - short title
  - why it matters
  - one evidence citation (`startLine:endLine:path`)
  - concise fix direction

If no significant issues are found, say so explicitly and list any residual risk.

## 4. Write Dated Audit File (Required)

Write audit to:

- `heartgarden/docs/REVIEW_YYYY-MM-DD_HHMM.md` (UTC date; `HHMM` is 24-hour, zero-padded, e.g. `0930`, `2115`)
- If that exact name exists, use `REVIEW_YYYY-MM-DD_HHMM-2.md`, then `-3`, etc.

Include frontmatter:

- `status: supporting`
- `audience: [agent, human]`
- `last_reviewed: YYYY-MM-DDTHH:MM:00Z` (UTC, matching this run)
- `related:` key docs for this change

End output with sentinel:

`REVIEW_AUDIT_WRITTEN: heartgarden/docs/REVIEW_YYYY-MM-DD_HHMM.md`

## 5. Mandatory Fix-Pass Handoff (Do Not Skip)

After audit creation, immediately run fix pass by following:

- `.cursor/skills/review-heavy/FIX_PASS.md`

Treat this as mandatory for `/review-light` and `/review-heavy`. Do not rely only on hook delivery.

Classifier policy:

- `SAFE`: may proceed after one batched approval prompt.
- `RISKY`: explicit user approval required.
- `NET_NEW`: explicit user approval required.

## 6. Escalation Rule

Recommend running `/review-heavy` when:

- changes include auth, migrations, API contracts, realtime/sync core, or major refactors
- confidence is low on a critical path
- user asks for maximum thoroughness
