---
name: review-light
description: >-
  Runs a cheaper, faster code review using three parallel Composer 2 subagent
  passes and returns high-signal findings with file evidence. Writes
  heartgarden/docs/REVIEW_YYYY-MM-DD_HHMM.md (UTC date and 24h time). Use when
  the user invokes /review-light, wants a low-cost review, or needs a quick
  pre-commit sanity check.
---
# /review-light

Use this for low-cost review. Prefer `review-heavy` when the change is large, risky, or release-bound.
Read and follow `.cursor/skills/review-common/CLOSURE_POLICY.md` as mandatory policy.

## 0. Cost-Constrained Mode

- Run exactly three review subagent passes in parallel.
- Each pass must use `subagent_type: generalPurpose`, `readonly: true`.
- Use model `composer-2-fast` for all three passes.
- Keep this as a constrained mini-swarm (exactly 3, not more).
- Write a dated audit file every run so fix-pass can execute deterministically.

Launch all three in one tool message so they run concurrently:

1. Security/auth + correctness/data-integrity reviewer
2. Performance/hot-path + concurrency risk reviewer
3. API/docs/contract drift + maintainability reviewer

## 1. Scope Detection (Smart Auto)

1. If user gave scope, use it.
2. Else if working tree is dirty, review uncommitted diff + untracked files.
3. Else if feature branch and `origin/main` exists, review `origin/main...HEAD`.
4. Else review `HEAD`.

## 1b. Pre-Review Vibe Check (Required)

Before launching subagents, emit the plain-English preamble required by `.cursor/skills/review-common/CLOSURE_POLICY.md` → "Pre-Review Vibe Check". Keep it to ~3 lines: what scope, 3 fast passes with `composer-2-fast`, ~1 min expected.

## 2. Review Focus (High-Signal Only)

Limit to up to 8 findings total, prioritized by risk:

1. correctness regressions
2. security/auth/data-integrity issues
3. performance hot-path risks
4. documentation/contract drift that can mislead future work

Skip style-only nits unless they hide a real bug.

## 3. Output Format

Follow `.cursor/skills/review-common/CLOSURE_POLICY.md` → "Audit Format Requirements":

- **Plain summary** at the top (3–6 sentences, product-designer language)
- `CRITICAL/HIGH/MEDIUM/LOW` buckets
- Each finding includes:
  - short title
  - severity + classifier (`SAFE` / `RISKY` / `NET_NEW`)
  - `confidence: 0.00–1.00` badge
  - one-line **User-facing impact**
  - one evidence citation (`startLine:endLine:path`)
  - concise fix direction
- `What is working well (don't break these)` — short bulleted list of behaviors/files that look healthy; helps the user avoid accidental regressions during the fix pass.

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

Classifier policy (full details in `.cursor/skills/review-common/CLOSURE_POLICY.md`):

- `SAFE`: auto-apply without prompting; list applied fixes in the closure report.
- `RISKY`: must ask via the `AskQuestion` tool, with plain-language context and pros/cons.
- `NET_NEW`: must ask via the `AskQuestion` tool, with plain-language context and pros/cons.

Questions Phase rules (apply to `/review-light` too):

- Use the `AskQuestion` tool — never ask risky questions as free-form prose.
- Batch related questions sensibly (default by severity, 3–6 per batch). Isolate very risky items (auth, destructive migrations, billing, public API breaks) into their own single-question call.
- Each question is multiple choice with a clear `Apply recommended fix`, at least one real alternative when applicable, and a `Skip / decline` option. Include a recommendation plus pros/cons in the prompt.
- Write for a layman product designer; translate jargon.

## 6. Full-Closure Requirement (All Findings)

`/review-light` must complete remediation for all findings in the same run by applying `.cursor/skills/review-common/CLOSURE_POLICY.md` (including terminal states and user-question requirements).

## 7. Escalation Rule

Recommend running `/review-heavy` when:

- changes include auth, migrations, API contracts, realtime/sync core, or major refactors
- confidence is low on a critical path
- user asks for maximum thoroughness
