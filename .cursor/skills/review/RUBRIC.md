# Review Rubric (heartgarden)

Use this rubric for every specialist and synthesizer pass.

## Severity Ladder

- `CRITICAL`: ship-blocker, security vulnerability, silent data loss/corruption, auth bypass, transaction integrity failure.
- `HIGH`: real bug or operational risk likely to impact users or correctness.
- `MEDIUM`: meaningful performance/maintainability debt with plausible user/team cost.
- `LOW`: polish, consistency, or readability suggestions.

## Confidence Calibration

Attach confidence `0.0-1.0` to each finding.

- `< 0.50`: do not include the finding.
- `0.50-0.74`: include but downgrade one severity level.
- `>= 0.75`: severity can remain as assessed.

## Evidence Standard

- Every finding must include code evidence with file references.
- Prefer concise citations that directly prove the issue.
- If evidence is incomplete, call it out as an assumption and lower confidence.

Required code citation format:

```12:20:path/to/file.ts
// evidence lines
```

## False-Positive Controls

- No evidence, no finding.
- Do not infer intent from naming alone.
- Re-trace control flow before finalizing severity.
- If uncertain between two severities, choose the lower one.
- Prefer one high-signal issue over many speculative nits.

## Required Finding Format

For each finding include:

1. Title
2. Severity
3. Confidence (`0.0-1.0`)
4. Why it matters (behavior/risk)
5. Evidence citation
6. `Fix direction:` one actionable paragraph

## Heartgarden-Specific Risk Checks

Always watch for:

- Access-control drift on API routes, especially GM/boot-gated operations.
- Missing optimistic-lock or transaction safety on multi-step writes.
- Error swallowing (`catch {}`) that hides failed server operations.
- Realtime/sync races from stale closures, reconnection storms, or missing aborts.
- Naming/identifier breakage against `docs/NAMING.md` (`vigil:*` compatibility surfaces).
- Documentation contract drift against `docs/API.md`, `docs/FEATURES.md`, `docs/CODEMAP.md`, `docs/VERCEL_ENV_VARS.md`.
- CSS module misuse that breaks webpack/module semantics.

## Output Sections (Synthesizer)

In this order:

1. CRITICAL
2. HIGH
3. MEDIUM
4. LOW
5. Open questions/assumptions
6. What is working well (don't break these)
7. Recommended attack order

If no findings exist, say that explicitly and note residual test/coverage risk.
