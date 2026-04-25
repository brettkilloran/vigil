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

## 2. Backlog Sources (Scan) + SOT Write Rule

**SOT (single source of truth) for open engineering backlog:** `heartgarden/docs/BACKLOG.md`. All new items, score caches, DNF edits on items that **originated here**, and Review-sourced NET_NEW overflow go into this file.

**Scan-everywhere, write-to-SOT rule:** scan all sources below on every normal run so nothing is orphaned. DNF/strike-through edits still happen **in-place** on the source that holds the item (so the breadcrumb is where a reader would look). But **new** items and consolidation moves always land in `BACKLOG.md`, with a `<!-- moved-to: docs/BACKLOG.md#<anchor> ... -->` breadcrumb on the original if the source keeps a pointer.

**Plan files are bundled context, not competing sources.** A `.cursor/plans/<slug>.plan.md` is the **deep design context** for whatever backlog entry links to it. When a `BACKLOG.md` entry includes a `Plan:` link to a plan file (or its score cache cites one in `code_refs`), that plan file is **part of the bundle** for that entry — Codex must read it for context but **must not** re-surface its YAML todos as separate Top 3 candidates, score them as standalone items, or duplicate their content into `BACKLOG.md`. The bundle pattern is:
- **Backlog entry** = title + score + 1–2 paragraph summary + risk callouts + `Plan:` link + `code_refs` for staleness.
- **Plan file** = the full design (goals, todos, tasks, acceptance criteria, diagrams, code sketches). This is where the detail lives so we never rewrite it into the backlog.
- **Score cache** lives on the backlog entry only. Per-todo `backlog_score` keys inside a plan are for future plan-execution flows, not `/backlog` triage.

Sources to scan, in order of authority:

1. **`heartgarden/docs/BACKLOG.md`** — SOT. Sections: `Near-term — hardening & parity`, `Lore import + data pipeline`, `Mid-term`, `Later`, `Cross-cutting code health`, `Review-sourced backlog`, `Archive`.
2. `heartgarden/docs/BUILD_PLAN.md` — architecture + shipped-tranches history only (after 2026-04-23). Scan the `Completed tranches` table to recognize already-shipped work (useful for `already-fixed` DNF detection); do not expect open backlog here.
3. `.cursor/plans/*.plan.md` — **two roles, decided per-file**:
   - **Bundled context** (default when a `BACKLOG.md` entry already links to the plan): read for design depth, cite the plan path inline when surfacing the backlog entry, never re-extract its todos as separate candidates. The plan content is "free context" the backlog entry's summary leans on.
   - **Orphan source** (only when no `BACKLOG.md` entry links to the plan): surface the plan as a candidate in its own right, with a recommended consolidation that *creates* a summary entry in `BACKLOG.md` linking to the plan (rather than copying the plan's content over). Ignore plans whose `README` row says `Completed / parked` or `Superseded`.
   In both modes, never file *new* items into plan files — file into `BACKLOG.md`. Plans are write-once-per-design-iteration; the backlog index moves more often.
4. `heartgarden/docs/REVIEW_*.md` — findings with terminal state `QUESTION_FOR_USER` that were never resolved in a later review. If surfaced and still real, migrate into `BACKLOG.md` under `Review-sourced backlog` with a breadcrumb on the review file.
5. `heartgarden/docs/FOLLOW_UP.md` — human/keys/infra only (not engineering backlog). Tag `[human]` and leave in place; only migrate to `BACKLOG.md` if it's clearly engineering work that drifted in.
6. `heartgarden/docs/GO_LIVE_REMAINING.md` — release gates / operator runbook only. Same rule: migrate out if engineering drift is detected.

Every candidate surfaced must include its source path and anchor (section or todo id) so the user can jump straight to it. When a candidate has a bundled plan, the plan path is also surfaced inline.

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
2. **Thematic clusters** — **run this BEFORE scoring** so cluster members are not re-fragmented into standalone candidates. A "thematic cluster" is when one existing entry in `BACKLOG.md` (with or without a linked plan file) is a unifying feature/plan that subsumes 2+ smaller open items elsewhere in the backlog. For each cluster:
   - **Canonical entry**: path + anchor + title (the unifying plan/feature in `BACKLOG.md`).
   - **Bundled plan(s)**: list of `.cursor/plans/*.plan.md` paths the canonical entry links to or which clearly form its deep context. State explicitly that these plan files are "bundled context — do not re-surface as separate candidates." If a subsumed item is *already* a `.cursor/plans/*.plan.md` orphan with no `BACKLOG.md` summary, the recommended consolidation creates one (a summary entry that links to the orphan plan) rather than copying the plan's content.
   - **Subsumed items**: list of paths + anchors + titles for each smaller open item that is a facet of the canonical entry.
   - **Why they belong together**: one-line rationale citing what the canonical plan delivers vs what each subsumed item asks for. Be concrete — generic thematic overlap is not enough; the canonical plan must actually ship the smaller item's outcome. Cite the plan file's `Goals` / `Tasks` / `Acceptance criteria` lines when possible since those are the contract the canonical entry summarizes.
   - **Recommended consolidation**: collapse the subsumed items into a "Phase X themes this entry subsumes" (or equivalent) callout on the canonical entry, replace the loose bullets at the source with a brief framing paragraph that names the legacy themes and points down at the canonical entry. Add a `<!-- consolidated YYYY-MM-DD: <legacy items> collapsed into <canonical anchor> -->` breadcrumb. The canonical entry's callout is a **short mapping** (theme → "delivered by `<plan tool / route / task>`"), not a duplication of the plan's design — depth lives in the plan file. Do **not** strike-through legacy bullets — they aren't DNF, they're unified.
   - **Items inside an active cluster do not appear as standalone Top 3 candidates.** They count once, as the canonical entry.
3. **Top 3 candidates** (aligned to mood; for `agents-pick` return one feature + one risk + one cruft):
   - title
   - source path + anchor
   - **bundled plan path** (if any) — the `.cursor/plans/<slug>.plan.md` that holds the deep design. Cite it inline so the user can jump there for detail; do not re-state its content in the candidate block.
   - one-line user-facing impact (from the backlog entry's summary, not from re-deriving the plan)
   - score breakdown (impact / fit / risk / cost) + composite
   - recommended approach (2–4 bullets — for bundled candidates these reference plan task IDs / sections rather than re-explaining)
   - rough size: S / M / L
   - risk call-outs
   - cache status: `fresh` / `recomputed` with reason
4. **DNF candidates** — items that look stale / already fixed / superseded / out-of-strategy. For each:
   - title + source path + anchor
   - DNF reason code (`already-fixed` / `superseded` / `out-of-strategy` / `stale-code-drift`)
   - evidence (file:line for code-grep, PR / commit / review reference, or successor plan path)
   - recommended in-place edit (exact strike-through + comment)
5. **Score cache updates** — list of items whose scores were (re)computed this run, with the comment string to append.
6. **Source hygiene notes** — observations about any sources that look empty, entirely stale, or redundant (feeds the consolidation mode).

Use the severity and confidence calibration conventions from `.cursor/skills/review-heavy/RUBRIC.md` where applicable.

## 5. Parent Agent: Present and Decide (Questions Phase)

Once Codex returns, the parent agent must:

1. Write a short plain-English summary (4–8 sentences) of the 3 candidates and DNF count. No jargon without a definition.
2. Use `AskQuestion` — see `.cursor/skills/review-common/CLOSURE_POLICY.md` → "Questions Phase" for exact format. Emit two-to-four batched calls (Batch C is conditional, Batch A is conditional):

   **Batch A — DNF approval** (only if Codex surfaced DNF candidates). Single multi-select `AskQuestion`:
   - One option per DNF item, pre-checked. Each option label includes title + reason code.
   - Plus `Apply none of these` and `Apply all`.
   - Prompt includes: what DNF means ("we'll strike through the item and add a note explaining why"), that nothing is deleted (only struck), and that it's fully reversible via git.

   **Batch C — Cluster consolidation** (only if Codex surfaced thematic clusters in §2 of its report). Run this **before** Batch B so the user picks a planning candidate against a clean, consolidated backlog. Single multi-select `AskQuestion`:
   - One option per cluster, pre-checked. Each option label includes the canonical entry title + a count like `(folds 3 items)`.
   - Plus `Apply none of these` and `Apply all`.
   - Prompt explains in plain language: "we'll fold N smaller items into the existing unifying entry, replace their loose bullets with a short framing paragraph that names the legacy themes, and add a 'subsumes' callout on the canonical entry. Nothing is deleted; the legacy themes stay named in-place. This prevents the same idea from being scattered across multiple bullets that all point at one plan."
   - For each option, list the subsumed item titles inline so the user sees exactly what they're approving.

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
2. **Cluster consolidations** — for each approved cluster:
   - **On the canonical entry in `BACKLOG.md`**: add a "Phase X themes this entry subsumes" (or "Subsumes") callout listing each subsumed legacy theme on its own line with a **one-line "how this plan delivers it" mapping** (theme → MCP tool / route / component / plan task ID that addresses it). Keep this short — it's an index, not a re-derivation. The canonical entry must already include a `Plan:` link to the plan file holding the deep design; if it doesn't, add one.
   - **In the bundled plan file** (`.cursor/plans/<slug>.plan.md`): editing the plan is **optional**. If the plan already covers the subsumed themes inside its `Goals` / `Tasks` / `Acceptance criteria`, leave it alone — the backlog callout is enough. Only edit the plan if a subsumed theme is genuinely missing from it (in which case add a single bullet to `Goals` or a single new YAML todo, and call that out in the closure report — this is a plan-scope change, not just a backlog reorg).
   - **At the source section** where the legacy bullets lived: replace the loose bullets with a brief framing paragraph that names the legacy themes and points down/across at the canonical entry. Do **not** strike-through — these aren't DNF, they're unified. Leave a breadcrumb comment immediately above or below the framing paragraph: `<!-- consolidated <YYYY-MM-DD>: <legacy items, comma-separated> collapsed into <canonical anchor> -->`.
   - **Orphan-plan promotion** — if the cluster's canonical context is a `.cursor/plans/<slug>.plan.md` that does **not yet have** a `BACKLOG.md` summary entry, *create one* in the appropriate `BACKLOG.md` section. The new entry follows the bundle pattern: short summary + score cache + `Plan:` link + risk callouts. **Never copy the plan's content into `BACKLOG.md`.** The new entry is an index that points readers at the plan; the plan stays the source of truth for design depth.
   - If a subsumed item lived in a different file (e.g. `BUILD_PLAN.md`, an old review, or `FOLLOW_UP.md`) leave a `<!-- moved-to: docs/BACKLOG.md#<canonical-anchor> consolidated=<YYYY-MM-DD> -->` breadcrumb at its original location instead of replacing the bullet — the original may be a historical record that shouldn't be rewritten.
   - Cluster consolidation never deletes content and never duplicates plan content. Reframe in-place; lean on the bundle.
3. **Score caches** — for each item Codex (re)scored this run (whether surfaced as a top-3 candidate or not), append the cache comment to the source item per `SCORING.md`. Items inside a cluster have their cache attached to the canonical entry; do not score subsumed bullets independently.
4. Record a ledger of what was edited (file + line or anchor) for the closure report. Distinguish DNF edits from cluster consolidations — they are different operations with different intent.

Do not commit. Leave the working tree dirty so the user can review the diff.

## 7. Consolidation Mode (`/backlog consolidate`)

Skip mood + triage. Run one Codex subagent whose sole job is to cross-reference sources and produce:

- **Duplicate coverage** — items in two or more sources that describe the same scope (include both paths + anchors, similarity confidence, suggested canonical home — **default canonical home is `heartgarden/docs/BACKLOG.md`** unless the item is clearly operator-runbook or human-infra in nature).
- **Thematic clusters** — same shape as Section 4 §2 (Stage 1 triage). Multiple distinct items that are facets of one unifying plan or feature, where one canonical entry already exists or could be created. Distinct from "duplicate coverage" — clusters describe items asking for different sub-outcomes that all roll up to one plan, not items that say the same thing twice. Each cluster includes the canonical entry, the subsumed items, the why-they-belong rationale, and the recommended consolidation edits per Section 6 §2.
- **Stale sources** — whole files or sections where >N% of items are already DNF-worthy.
- **Recommended merges / retirements** — concrete "move X to Y" or "archive section Z" proposals, with exact edits. Default target for moves is `BACKLOG.md`.
- **SOT drift** — items that *should* be in `BACKLOG.md` but have drifted into `FOLLOW_UP.md`, `GO_LIVE_REMAINING.md`, an old review, or a plan file. Flag them for migration with a `<!-- moved-to: docs/BACKLOG.md#<anchor> -->` breadcrumb at the original and a fresh row in `BACKLOG.md`.

Parent agent presents via `AskQuestion` multi-select (one batch per category — duplicate coverage, thematic clusters, stale sources, merges, SOT drift): apply none / apply subset / apply all. On approval, apply the edits using the Section 6 shapes (DNF for stale, cluster consolidation for thematic clusters, in-place rewrite for duplicate coverage and SOT drift). Do not proceed to Stage 2 planning in consolidation mode.

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
- Cluster consolidations applied (count + canonical anchors + subsumed item count per cluster)
- Score cache entries added/updated (count)
- Source hygiene notes (if any)
- What happens next (either "Plan pass started for <title>" or "No plan pass this run")

If Stage 2 runs, its own closure report appends after this one.

## 10. Cost + Safety Notes

- Opus plan creation is expensive. Never run Stage 2 without explicit user selection in Batch B.
- Never create parallel Opus plans. One plan per `/backlog` run.
- Codex triage is read-heavy; if context runs hot, summarize source files rather than reading them wholesale.
- Respect `.cursor/rules/heartgarden-local-dev.mdc` — do not spawn dev servers unless a downstream step requires it.
