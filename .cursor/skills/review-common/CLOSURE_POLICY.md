# Review Closure Policy (Shared)

Use this policy for both `/review-heavy` and `/review-light`.

## Goal

Drive the review run to **full closure** for every finding in `CRITICAL/HIGH/MEDIUM/LOW`.

The user is a product designer / vibecoder, not a backend engineer. Assume they will not read the raw audit. Translate findings into plain language, group related decisions, and only ask about things that actually need a choice.

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

**Always-RISKY categories** (never classify as SAFE, regardless of diff size):

- Auth, session, boot-gate, permissions
- Database migrations, schema changes, destructive data ops
- Billing, payments, credits
- Realtime / sync core (`heartgarden-*-sync*`, presence, delta polling)
- Public API route contracts (request/response shape, status codes)
- MCP tool contracts

## Approval Rules (Strict)

- `SAFE`: **auto-apply without asking.** Do not prompt. Do not batch-approve. Just fix, verify, and list in the closure report.
- `RISKY`: must ask the user via `AskQuestion` before editing. Include pros/cons and a recommendation.
- `NET_NEW`: must ask the user via `AskQuestion` before editing. Include pros/cons and a recommendation.

If uncertain whether a finding is SAFE or RISKY, treat it as RISKY and ask.

## Audit Format Requirements (Shared)

Both `/review-heavy` and `/review-light` audit files must include:

1. **Plain summary at top** (after frontmatter, before severity sections):
   - 3–6 sentences explaining in product-designer language what was reviewed, what the biggest concerns are, and what's safe.
   - No jargon without a one-line definition.
2. **Per-finding fields** (in this order):
   - Title (short, concrete)
   - Severity + classifier (`SAFE` / `RISKY` / `NET_NEW`)
   - **Confidence** badge (`confidence: 0.00–1.00`)
   - **User-facing impact** (one line: what a user or the team would actually notice if this isn't fixed)
   - Evidence citation (`startLine:endLine:path`)
   - Fix direction

## Pre-Review Vibe Check (Required)

Before launching specialist subagents, the parent agent must emit a short plain-English preamble stating:

- What scope will be reviewed (e.g. "6 changed files since `main`, mostly the lore import flow")
- Which specialists / passes will run
- Rough expectation ("heavy audit: ~few minutes, multiple Codex agents" vs "light audit: ~1 minute, 3 fast agents")

Keep it to ~4 lines. This lets the user catch a scope mismatch before tokens burn.

## Prior-Review Deduplication

Before the questions phase, scan the most recent audit files in `heartgarden/docs/REVIEW_*.md` (last 5 by filename sort).

For each current finding:

- If it was previously marked `DECLINED_BY_USER` and nothing material changed in the evidence, **skip silently** and note it in the closure report's deduped list.
- If it was previously marked `FIXED` but now reappears with the same evidence, **flag as a regression**, raise severity by one tier (capped at CRITICAL), and treat as RISKY regardless of diff size.
- If previously `QUESTION_FOR_USER` with no terminal answer, carry forward and ask again.

Record dedupe decisions in the ledger so the user can audit them.

## Questions Phase (Mandatory Format)

When there are `RISKY` or `NET_NEW` findings to resolve, the agent **must**:

1. Use the `AskQuestion` tool. Never ask risky/net-new questions as free-form prose in chat.
2. Write questions for a layman. Avoid jargon; when a term is unavoidable, give a one-line definition inline.
3. Before each `AskQuestion` call, emit a short plain-language preamble (2–6 sentences) that explains:
   - what the problem is in product terms
   - what part of the app it affects
   - why a decision is needed (what happens if nothing changes)
4. Batch sensibly. Default grouping is by severity, collapsing small tiers together; an alternate grouping by subsystem (auth, data, perf, sync, docs) is acceptable when it reads more clearly. Keep each batch to roughly 3–6 questions so the user can answer without fatigue.
5. For **very risky** items (auth bypass, destructive data migration, billing, public API break, irreversible destructive change), use a **single-question `AskQuestion` call** for that one item so it is not lost in a batch.
6. Every question must be multiple choice with at least these options:
   - `Apply recommended fix` (mark the recommendation clearly in the label)
   - At least one concrete alternative when a real alternative exists
   - `Skip / decline this fix`
7. Provide pros/cons in the question prompt (not only options) for `RISKY` and `NET_NEW` findings. Format:
   - Recommendation: <one line>
   - Pros: <1–3 bullets, plain language>
   - Cons / risks: <1–3 bullets, plain language>
8. Do not ask about `SAFE` findings. They are auto-applied and listed in the closure report only.
9. If answers introduce new ambiguity, ask a follow-up `AskQuestion` call rather than guessing.

## Post-Fix Verification Gate

After each batch of fixes (SAFE or approved RISKY/NET_NEW):

1. Re-run the same commands captured in the baseline (at minimum: `npm run check` and `npm run test:unit`, from `heartgarden/`).
2. Compare against the baseline result. A fix is `FIXED` only if **no new failures** appeared that were not present in the baseline.
3. If new failures appear:
   - Attempt up to **2 targeted fixes**.
   - If still failing, **roll the offending fix back** to the pre-fix checkpoint (`git checkout` the affected files from the checkpoint commit) and promote the finding to `QUESTION_FOR_USER` with a plain-language explanation of what broke.
4. Record verification command + outcome per finding in the ledger.

## Stuck-State Escalation

- If applying a `SAFE` fix reveals hidden complexity (type errors cascading, unexpected test failures, unclear call sites) and 2 attempts don't land a clean fix, **reclassify as RISKY** and ask the user via `AskQuestion`.
- If any step is ambiguous and the agent finds itself guessing, stop and ask.

## UI Fix Verification (when applicable)

When a fix touches visible UI (files matching `src/components/**/*.tsx`, `app/**/page.tsx`, `app/globals.css`, `*.module.css`, Storybook stories):

1. Ensure the local dev server is running (`npm run dev` from `heartgarden/`) or start it per `.cursor/rules/heartgarden-local-dev.mdc`.
2. Use the `cursor-ide-browser` MCP to take a **before** screenshot at `http://localhost:3000` (capture the relevant route) **prior** to applying the fix when feasible; otherwise skip the before.
3. After the fix, navigate to the same route and take an **after** screenshot.
4. Include both screenshot paths in the closure report under a "UI changes" subsection. Also note any unexpected visual regressions observed.

If the dev server cannot be started, note that UI verification was skipped and why.

## NET_NEW Feature Overflow → Backlog

If a `NET_NEW` finding would realistically require more than ~5 files, introduce a new subsystem, or otherwise feels like a feature project:

1. Do not ask a yes/no question. Instead, append a backlog entry to `heartgarden/docs/BACKLOG.md` under the `## Review-sourced backlog` section (already present; create if somehow missing), matching the file's table/bullet style.
2. The entry must include:
   - short title
   - severity + user-facing impact (one line)
   - evidence citation (file:line)
   - recommended approach (2–5 bullets)
   - rough cost estimate (S / M / L) and risk call-out
   - source audit path (the current `REVIEW_*.md` filename)
3. Mark the finding `DECLINED_BY_USER` in this run (with note "filed to BACKLOG") so closure doesn't block.
4. List all backlog entries filed in the closure report so the user sees what was punted.

## Remediation Ledger (Required)

Track each finding with:

- finding id/title
- severity
- classifier (`SAFE`/`RISKY`/`NET_NEW`)
- state (`FIXED`/`QUESTION_FOR_USER`/`DECLINED_BY_USER`)
- verification note (including post-fix command outcome)
- dedupe note (if applicable)
- screenshot paths (if UI fix)

## Completion Contract

Finish with a compact closure report containing:

- counts by terminal state
- **SAFE fixes applied** (bulleted list, one line each: what changed + file)
- files changed
- verification commands and outcomes (baseline vs post-fix diff summary)
- **UI changes** (before/after screenshot paths, if any)
- **Deduped from prior audits** (titles only)
- **Filed to backlog** (titles + `BACKLOG.md#review-sourced-backlog` anchor)
- **Next session ideas** (non-binding; things noticed but intentionally not touched this run — smells, unrelated cleanups, follow-ups from declined NET_NEW, etc.)
- explicit outstanding user questions (if any) — should normally be empty once the questions phase completed
