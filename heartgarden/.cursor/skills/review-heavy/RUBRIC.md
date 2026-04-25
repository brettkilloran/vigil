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
