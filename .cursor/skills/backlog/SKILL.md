---
name: backlog
description: >-
  Surfaces up to 3 high-leverage backlog candidates from heartgarden's scattered
  backlog sources, detects stale/DNF items, asks the user which to deep-plan
  next, and (on approval) kicks off a per-item Opus plan-creation pass that
  writes a .cursor/plans/<slug>.plan.md. Use when the user invokes /backlog,
  says "what's next?", or wants to groom and start fresh work.
---

# /backlog

Two-stage workflow:

- **Stage 1 — Triage (this file):** one **Codex** subagent (latest slug, e.g. `gpt-5.3-codex`) scans sources, scores items, detects DNF candidates, and surfaces 3 picks. Parent agent asks the user via `AskQuestion` which candidate to plan.
- **Stage 2 — Plan creation (`PLAN_PASS.md`):** triggered only on user approval. Up to **one plan per run** is produced by an **Opus** subagent (latest slug, e.g. `claude-4.6-opus-high-thinking`) with code analysis support.

Read and follow:

- `.cursor/skills/backlog/SCORING.md` — rubric, cache format, staleness heuristics
- `.cursor/skills/backlog/PLAN_PASS.md` — Stage 2
- `.cursor/skills/review-common/CLOSURE_POLICY.md` — Questions Phase format (batched `AskQuestion` with plain-language preambles and pros/cons)
- `heartgarden/AGENTS.md` — canonical architecture + read order

## 0. Preconditions

- Read `heartgarden/AGENTS.md` first.
- Keep Stage 1 read-only **except** for:
  - Score-cache updates on backlog items (tiny HTML comments — see SCORING).
  - DNF edits to backlog files, and only after explicit user approval in Stage 1.
- No dev server, commits, pushes, or deploys in Stage 1.

## 1. Invocation Modes

- `/backlog` (default): mood-driven triage → 3 candidates → optional DNF edits → optional plan.
- `/backlog consolidate`: run the **consolidation pass** (Section 7) instead of normal triage. Use when the user wants to prune / merge scattered backlog sources.

## 2. Backlog Sources (Scan)

Scan all of these on every normal run. Note which sources smell stale in the report so the user can consolidate later:

1. `heartgarden/docs/BUILD_PLAN.md` — canonical. Sections: `Code health backlog`, `Near-term — hardening & parity`, `Mid-term`, `Later`, and the `Review-sourced backlog` section created by `/review-*`.
2. `.cursor/plans/*.plan.md` — YAML `todos` with `status: pending`. Ignore plans whose README row says `Completed / parked` or `Superseded`.
3. `heartgarden/docs/REVIEW_*.md` — findings with terminal state `QUESTION_FOR_USER` that were never resolved in a later review.
4. `heartgarden/docs/FOLLOW_UP.md` — human/infra work. Include but clearly tag `[human]` so it's not mistaken for agent-plannable.
5. `heartgarden/docs/GO_LIVE_REMAINING.md` — release gates.

Every candidate surfaced must include its source path and anchor (section or todo id) so the user can jump straight to it.

## 3. Mood Preamble (Required)

Before launching the triage subagent, ask the user what flavor of work to look for. Use `AskQuestion` with these options (single select):

- `ship-feature` — pull a concrete user-visible feature candidate
- `kill-risk` — pull a hardening / safety / security candidate
- `clear-cruft` — pull a cleanup / tech-debt / dedupe candidate
- `unblock-users` — pull a bug / UX / friction candidate
- `agents-pick` — agent returns 1 of each (feature + risk + cruft) as a balanced menu

Record the chosen mood; Codex uses it to filter and to decide whether cached scores are reusable (see SCORING).

## 4. Launch the Codex Triage Subagent (Stage 1)

Single subagent, in one tool message.

Common requirements:

- `subagent_type: generalPurpose`
- `readonly: true` (Codex should **not** write score caches directly — it returns them, parent agent applies them)
- Model: latest Codex slug from the platform allowlist (e.g. `gpt-5.3-codex` today).
- Load and follow `.cursor/skills/backlog/SCORING.md`.
- Cite every claim with a file reference (`path:line` or section anchor).

Codex must produce a structured report with these sections:

1. **Summary** (3–5 plain-language sentences for a layman product designer)
2. **Top 3 candidates** (aligned to mood; for `agents-pick` return one feature + one risk + one cruft):
   - title
   - source path + anchor
   - one-line user-facing impact
   - score breakdown (impact / fit / risk / cost) + composite
   - recommended approach (2–4 bullets)
   - rough size: S / M / L
   - risk call-outs
   - cache status: `fresh` / `recomputed` with reason
3. **DNF candidates** — items that look stale / already fixed / superseded / out-of-strategy. For each:
   - title + source path + anchor
   - DNF reason code (`already-fixed` / `superseded` / `out-of-strategy` / `stale-code-drift`)
   - evidence (file:line for code-grep, PR / commit / review reference, or successor plan path)
   - recommended in-place edit (exact strike-through + comment)
4. **Score cache updates** — list of items whose scores were (re)computed this run, with the comment string to append.
5. **Source hygiene notes** — observations about any sources that look empty, entirely stale, or redundant (feeds the consolidation mode).

Use the severity and confidence calibration conventions from `.cursor/skills/review-heavy/RUBRIC.md` where applicable.

## 5. Parent Agent: Present and Decide (Questions Phase)

Once Codex returns, the parent agent must:

1. Write a short plain-English summary (4–8 sentences) of the 3 candidates and DNF count. No jargon without a definition.
2. Use `AskQuestion` — see `.cursor/skills/review-common/CLOSURE_POLICY.md` → "Questions Phase" for exact format. Emit two (or three) batched calls:

   **Batch A — DNF approval** (only if Codex surfaced DNF candidates). Single multi-select `AskQuestion`:
   - One option per DNF item, pre-checked. Each option label includes title + reason code.
   - Plus `Apply none of these` and `Apply all`.
   - Prompt includes: what DNF means ("we'll strike through the item and add a note explaining why"), that nothing is deleted (only struck), and that it's fully reversible via git.

   **Batch B — Plan trigger** (required). Single-select `AskQuestion`:
   - One option per top candidate: `Plan candidate A: <title>` / `B` / `C`.
   - Plus `Skip planning this run`.
   - Prompt includes each candidate's one-line summary, score, size, and the top risk.
   - For the recommended candidate (highest composite score with mood fit), the option label is prefixed `Recommended:`.

   Do not ask about more than one plan per run — planning is sequential by design.

3. If any candidate is flagged `very-risky` (auth, migrations, billing, realtime/sync core, public API, MCP — the "always-RISKY" categories from `CLOSURE_POLICY.md`), give it its own single-question `AskQuestion` call so it can't be chosen without an extra beat of thought.

## 6. Apply Approved Edits

After answers:

1. **DNF edits** — for each approved DNF item, patch the source file:
   - In markdown tables/bullets, wrap the item text in `~~…~~` strike-through.
   - Append an HTML comment immediately after: `<!-- dnf: reason=<code> evidence=<path:line-or-ref> scored=<YYYY-MM-DDTHH:MMZ> -->`.
   - For `.cursor/plans/*.plan.md` YAML todos: change `status: pending` → `status: dnf` and append a trailing `note:` with the reason code and evidence.
   - If a whole plan file is DNF, also update `.cursor/plans/README.md` to move the row to `Completed / parked` (DNF note) or `Superseded`.
2. **Score caches** — for each item Codex (re)scored this run (whether surfaced as a top-3 candidate or not), append the cache comment to the source item per `SCORING.md`.
3. Record a ledger of what was edited (file + line or anchor) for the closure report.

Do not commit. Leave the working tree dirty so the user can review the diff.

## 7. Consolidation Mode (`/backlog consolidate`)

Skip mood + triage. Run one Codex subagent whose sole job is to cross-reference sources and produce:

- **Duplicate coverage** — items in two or more sources that describe the same scope (include both paths + anchors, similarity confidence, suggested canonical home).
- **Stale sources** — whole files or sections where >N% of items are already DNF-worthy.
- **Recommended merges / retirements** — concrete "move X to Y" or "archive section Z" proposals, with exact edits.

Parent agent presents via `AskQuestion` multi-select: apply none / apply subset / apply all. On approval, apply the edits. Do not proceed to Stage 2 planning in consolidation mode.

## 8. Stage-2 Handoff (Plan Creation)

If the user picked a candidate in Batch B (and not `Skip planning`), immediately hand off by reading and following `.cursor/skills/backlog/PLAN_PASS.md`. Pass it:

- the candidate block from the Codex report (as `<candidate>…</candidate>`)
- the mood tag
- the source anchor
- any relevant cross-references found during triage (related plans, reviews, code locations)

One plan per run. If the user wanted more, tell them to run `/backlog` again — this is intentional to keep plan quality high.

## 9. Closure Report (Stage 1 End)

End the run with a compact report:

- Mood selected
- Top 3 candidates (titles + one-line summaries + scores)
- DNF edits applied (count + titles)
- Score cache entries added/updated (count)
- Source hygiene notes (if any)
- What happens next (either "Plan pass started for <title>" or "No plan pass this run")

If Stage 2 runs, its own closure report appends after this one.

## 10. Cost + Safety Notes

- Opus plan creation is expensive. Never run Stage 2 without explicit user selection in Batch B.
- Never create parallel Opus plans. One plan per `/backlog` run.
- Codex triage is read-heavy; if context runs hot, summarize source files rather than reading them wholesale.
- Respect `.cursor/rules/heartgarden-local-dev.mdc` — do not spawn dev servers unless a downstream step requires it.
