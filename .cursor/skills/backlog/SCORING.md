# Backlog Scoring, Staleness, and Cache Format

Shared rubric + machine-readable cache format used by Stage 1 triage in `SKILL.md` and re-read by subsequent runs to avoid recomputing unchanged items.

## Scoring Rubric (Composite 0–10)

Each backlog item gets four component scores and one composite. All on 0–10 unless noted.

- **impact** (0–10): How much does shipping this move the product forward for real users? Tie to user-facing behavior, not internal elegance.
- **fit** (0–10): How well does this align with the current strategic direction (`AGENTS.md`, `docs/STRATEGY.md`, `docs/HEARTGARDEN_MASTER_PLAN.md`)? Penalize items that contradict the latest direction.
- **risk** (0–10): How risky is doing it (likelihood of regression, blast radius). Higher = riskier.
- **cost** (S / M / L): Rough engineering size. S ≈ ≤1 day, M ≈ 2–5 days, L ≈ >1 week.

**Composite formula** (deterministic; easy to reproduce):

```
cost_numeric = {S: 1, M: 3, L: 7}[cost]
composite = round( (impact * 0.45 + fit * 0.35 - risk * 0.10) / (0.5 + 0.5 * cost_numeric / 3), 1 )
```

Clamp composite to `[0.0, 10.0]`. This rewards high-impact, strategic fit, and small cost; lightly penalizes risk. Documented so any future agent can reproduce the same score given the same inputs.

### Mood Alignment

After computing the raw composite, apply a **mood multiplier** (max 1.0, never inflates above 10):

| Mood | Multiplier rule |
|------|-----------------|
| `ship-feature` | ×1.00 if item is a user-visible feature, ×0.70 otherwise |
| `kill-risk` | ×1.00 if item is hardening / safety / sync / auth / data integrity, ×0.70 otherwise |
| `clear-cruft` | ×1.00 if item is cleanup / dedupe / dead-code / deprecation, ×0.70 otherwise |
| `unblock-users` | ×1.00 if item is a bug / UX friction / accessibility, ×0.70 otherwise |
| `agents-pick` | ×1.00 for all; parent agent selects 1 feature + 1 risk + 1 cruft by descending composite within each bucket |

Record both raw and mood-adjusted composites in the cache.

## Score Cache Comment Format

Append as a single HTML comment line immediately after the backlog item text, on its own line. One comment per item, overwrite-in-place on recompute.

```
<!-- backlog-score v1 | impact=8 | fit=9 | risk=3 | cost=M | composite_raw=7.2 | composite_mood=7.2 | mood=ship-feature | scored=2026-04-23T12:34Z | model=gpt-5.3-codex | category=feature | code_refs=src/lib/foo.ts,src/components/Bar.tsx -->
```

Fields:

- `v1` — cache schema version; bump if fields change.
- `impact` / `fit` / `risk` — integers 0–10.
- `cost` — `S` / `M` / `L`.
- `composite_raw` — deterministic formula output (one decimal).
- `composite_mood` — after the mood multiplier.
- `mood` — the mood at scoring time.
- `scored` — ISO8601 UTC timestamp.
- `model` — the Codex model slug used.
- `category` — one of `feature` / `hardening` / `cleanup` / `bug` / `docs` / `human-infra`. Used for mood alignment.
- `code_refs` — comma-separated list of files the scorer cites as "material to this item." Empty if none. Used by freshness check.

For YAML todos in `.cursor/plans/*.plan.md`, use a sibling YAML key instead of an HTML comment:

```yaml
- id: some-id
  content: "..."
  status: pending
  backlog_score:
    v: 1
    impact: 7
    fit: 8
    risk: 2
    cost: S
    composite_raw: 7.9
    composite_mood: 7.9
    mood: ship-feature
    scored: 2026-04-23T12:34Z
    model: gpt-5.3-codex
    category: feature
    code_refs: [src/lib/foo.ts]
```

## Freshness Rule (When to Reuse Cache)

A cached score is **reusable** if **all** of the following hold:

1. `scored` is within the last **14 days**.
2. `mood` matches the current run's mood (or either is `agents-pick`).
3. No file listed in `code_refs` has been modified since `scored` (compare to `git log -- <path>` most-recent commit timestamp). If `code_refs` is empty, skip this check.
4. Cache schema version (`v`) matches the current version in this document.

If any check fails, recompute. Recompute always if the user passes an explicit "recompute" hint.

Rationale: the user works in intermittent bursts, so a pure age check is too strict (items can stay fresh a long time) but too loose without a code-drift check. The mood-match rule prevents a cached `ship-feature` score from being reused for a `kill-risk` run where the multiplier differs.

## Staleness / DNF Detection

The triage subagent runs these signals **in order**; the first that triggers wins the DNF reason. Always include concrete evidence.

1. **`already-fixed`** — grep / semantic search for the described fix or feature in the current codebase. If clearly implemented and working (tests, routes, UI present), mark DNF with file evidence.
2. **`superseded`** — another `.cursor/plans/*.plan.md` or `BUILD_PLAN.md` row covers the same scope better or more recently. Link the successor.
3. **`out-of-strategy`** — `AGENTS.md`, `STRATEGY.md`, `HEARTGARDEN_MASTER_PLAN.md`, or `LORE_ENGINE_ROADMAP.md` now point in a direction that excludes this item. Cite the passage.
4. **`stale-code-drift`** — linked code in the item description no longer exists at the cited path or has been refactored beyond recognition. Cite the current state.
5. **`prior-review-fixed`** — a `heartgarden/docs/REVIEW_*.md` audit marked the underlying issue `FIXED` with verification. Cite the audit filename + finding title.

Do **not** use age alone as a DNF reason. Age is a prompt to re-evaluate, not a verdict.

## DNF Edit Shapes

- **Markdown bullets / table rows**:
  ```
  - ~~<original text>~~ <!-- dnf: reason=already-fixed evidence=src/lib/foo.ts:142 scored=2026-04-23T12:34Z -->
  ```
- **YAML todo**:
  ```yaml
  - id: some-id
    content: "..."
    status: dnf
    dnf:
      reason: already-fixed
      evidence: "src/lib/foo.ts:142"
      scored: 2026-04-23T12:34Z
  ```
- **Plan file as a whole** (when most/all todos are DNF): add `Status: DNF (<reason>)` at the top and move the row in `.cursor/plans/README.md` to `Completed / parked` or `Superseded`.

Never delete content. Strike-through + comment only. The user can clean up later.

## Source Hygiene Signals (for Consolidation Mode)

Codex should flag these in the report (non-blocking for normal runs):

- A source file where ≥50% of items match a DNF signal.
- Items that appear in two or more sources with high textual / semantic similarity.
- Sources that haven't been touched in >90 days and have no active successors linked.
- Items that reference paths that no longer exist in the repo.
