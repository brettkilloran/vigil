---
name: backlog-plan-pass
description: >-
  Stage 2 of /backlog. After the user approves one candidate in Stage 1, runs a
  medium-depth code analysis in parallel (2 readonly Codex passes) and then
  launches a single Opus plan-creation subagent that interactively drafts a
  .cursor/plans/<slug>.plan.md matching heartgarden's existing plan conventions.
---

# Backlog Plan Pass (Stage 2)

Triggered only by explicit user selection in Stage 1 Batch B. Produces exactly one plan file. No commits.

Read and follow:

- `.cursor/skills/backlog/SKILL.md` — Stage 1 context + handoff contract
- `.cursor/skills/backlog/SCORING.md` — so risk/cost framing stays consistent
- `.cursor/skills/review-common/CLOSURE_POLICY.md` → "Questions Phase" — exact `AskQuestion` format (batched multi-choice, plain-language preambles, pros/cons)
- `heartgarden/AGENTS.md` + `heartgarden/docs/CODEMAP.md` — architecture + where logic lives
- `.cursor/plans/README.md` — plan index conventions (Active / Reference / Completed-parked / Superseded)

## 0. Inputs (from Stage 1)

- Candidate block (title, source anchor, score, recommended approach, risks)
- Mood tag
- Cross-references (related plans, reviews, code locations)

## 1. Slug + Output Path

Propose a kebab-case slug derived from the candidate title, matching existing patterns (`canvas_navigation_ux`, `players_multiplayer_hardening`, etc. — underscores are fine; stick to whichever convention the majority of sibling files use). If a file already exists at `.cursor/plans/<slug>.plan.md`, append `-2`, `-3`, etc.

Final path: `.cursor/plans/<slug>.plan.md`.

## 2. Code Analysis (Medium) — Parallel Readonly Codex Passes

Launch **two** subagents in one tool message:

- `subagent_type: generalPurpose`
- `readonly: true`
- Model: latest Codex slug (e.g. `gpt-5.3-codex`)

**Pass A — Codebase Mapper**
- Identify every file/function the plan will touch.
- Trace call sites, data flow, and affected API routes / DB tables.
- Output: a bulleted map of "files in scope" (with file:line anchors), "data shapes" (interfaces/tables), "API surfaces" (routes touched), "UI entry points" (components touched).

**Pass B — Risk / Regression Scanner**
- Cross-reference the plan scope against the always-RISKY categories (`CLOSURE_POLICY.md`): auth, migrations, billing, realtime/sync, public API, MCP.
- List adjacent subsystems at regression risk, with concrete citations.
- Flag any existing tests the plan must not break.
- Flag any migration or env-var implications.
- Output: "Risks + citations", "Tests to preserve", "Migration/env implications".

Both passes must cite every claim with `path:line` or section anchor. No speculation without evidence.

## 3. Opus Plan Author (One Subagent)

Single subagent, launched after both Codex passes return.

- `subagent_type: generalPurpose`
- `readonly: false` (it writes the plan file, nothing else)
- Model: latest Opus slug (e.g. `claude-4.6-opus-high-thinking`)
- Input: Stage 1 candidate block, mood, cross-references, Pass A + Pass B results.
- Tools: the author may use `AskQuestion` for clarifying questions, and may read any file. It must not edit anything except the target plan file.

### Plan File Format (Match Existing `.cursor/plans` Style)

Follow the shape of existing plans like `canvas_navigation_ux.plan.md`. Required structure:

```
---
name: <Human title>
overview: <One or two sentences stating what this plan delivers, in product language>
todos:
  - id: <kebab-id>
    content: "<atomic, testable work item>"
    status: pending
  - id: <…>
    content: "…"
    status: pending
isProject: <true | false>
source:
  backlog: <path:anchor from Stage 1>
  mood: <mood tag>
  scored_composite: <number from Stage 1 cache>
---

# <Human title>

## Context (current code)

<2–6 bullets citing file:line for each claim. Pulled from Pass A.>

## Goals

- <user-visible outcome 1>
- <user-visible outcome 2>

## Non-goals

- <explicitly out of scope item>

## Design

<Short narrative + any diagrams or sequence lists. Keep it concrete.>

## Tasks

<Mirror the YAML todos, expanded. Each task should name the files it touches and reference Pass A anchors.>

## Risks & mitigations

<Pulled from Pass B. Each risk has a mitigation or a "accept and monitor" note.>

## Acceptance criteria

<Checkable list. E.g. "Opening /api/foo returns 200 for seed data", "Unit test X passes", "UI shows Y when Z".>

## Verification commands

<Concrete commands from heartgarden/, e.g. `pnpm run check`, `pnpm run test:unit`, targeted Playwright specs, db:vault-setup if migrations, `pnpm run dev` for manual smoke, etc.>

## Open questions

<Only include if the author failed to resolve something even after AskQuestion; otherwise omit this section.>
```

Rules for Opus:

- **No vibes, only citations.** Every `Context` bullet, every `Tasks` item, and every `Risks` line must point at a real file or doc (use Pass A / Pass B evidence).
- **Tasks must be atomic.** Each YAML todo is one concrete unit of work that could ship on its own. If a task exceeds ~1 day of work, split it.
- **Testability first.** Every task must have a corresponding line in `Acceptance criteria` or be listed in `Verification commands`.
- **Respect always-RISKY categories.** If any task touches auth / migrations / billing / realtime-sync / public API / MCP, annotate that task with `risk: high` in a comment and call it out in `Risks & mitigations`.
- **Match conventions.** Use heartgarden's path style (relative from `heartgarden/`), reference `AGENTS.md` and `docs/CODEMAP.md` sections, and use the `vigil:item:` / `hgDoc` / `hgArch` terminology correctly.

### Interactive Clarification (AskQuestion)

Before finalizing the plan, Opus should emit **at most two** `AskQuestion` batches per the Questions Phase format in `CLOSURE_POLICY.md`:

- **Batch 1 — Scope & approach** (required when meaningful ambiguity exists): 3–6 multi-choice questions about scope boundaries, UX approach, data model choices, rollout strategy. Each question has Pros/Cons and a clear recommendation.
- **Batch 2 — Risky specifics** (only if Pass B flagged always-RISKY categories): 1–3 questions about migration strategy, auth behavior, API contract changes. Isolate any single very-risky decision into its own single-question call.

If no meaningful ambiguity exists, skip questions and deliver the plan directly. Do not ask questions just to perform diligence.

Never ask questions as free-form prose. Always use `AskQuestion`.

## 4. Register the Plan

After writing `.cursor/plans/<slug>.plan.md`:

1. Update `.cursor/plans/README.md`:
   - Add a row in the `## Active (still drives or may drive work)` table with the plan link and a one-line note.
2. **Promote / update the `BACKLOG.md` summary entry** so the plan has a bundled index entry (per the bundle pattern in `SKILL.md` §2):
   - **If the originating backlog item lives in `heartgarden/docs/BACKLOG.md`**: edit that entry so it (a) includes a `Plan: [.cursor/plans/<slug>.plan.md](...)` link in the body, (b) carries a brief 1–2 paragraph summary that matches the plan's `overview` field, (c) lists the plan path in the score cache's `code_refs` so freshness invalidates on plan edits, and (d) appends a backreference comment immediately under the entry heading:
     ```
     <!-- backlog-plan: path=.cursor/plans/<slug>.plan.md created=<YYYY-MM-DDTHH:MMZ> -->
     ```
     Do **not** copy the plan's design content into the backlog entry. The entry is the index; the plan is the detail.
   - **If the originating item lives in `BUILD_PLAN.md`** (pre-2026-04-23) or any other source that isn't `BACKLOG.md`, **create a new summary entry in `BACKLOG.md`** (in the appropriate section — `Near-term`, `Mid-term`, etc.) following the same bundle pattern: short summary + `Plan:` link + score cache including the plan path in `code_refs`. Leave a `<!-- moved-to: docs/BACKLOG.md#<anchor> created=<YYYY-MM-DDTHH:MMZ> -->` breadcrumb at the original location.
   - Do not strike through the original row — the work is just starting, not done. The breadcrumb routes future readers to the canonical entry.
3. If the originating source is a `REVIEW_*.md` `QUESTION_FOR_USER` that's now being planned, append the same `backlog-plan:` backreference beside that finding.

## 4b. Subsumption Check (prevents legacy bullets coexisting with the new plan)

Before closing, scan `heartgarden/docs/BACKLOG.md` and the other backlog sources listed in `SKILL.md` §2 for **open items that are facets of the new plan you just wrote**. This is the same "thematic cluster" pattern from `SKILL.md` §4 (Stage 1 triage), but applied at plan-creation time so the new plan doesn't ship into a backlog that still has scattered bullets pointing at the same outcome.

For each open item where the plan's `Goals` / `Tasks` / `Acceptance criteria` clearly deliver the item's outcome:

- Record it as a candidate for consolidation: source path + anchor + title, and the one-line "how the new plan delivers it" mapping.

If you found at least one candidate, present them via a single `AskQuestion` (multi-select, all options pre-checked) — same shape as `SKILL.md` Stage 1 Batch C:

- Title: `Fold these existing backlog items into the new plan?`
- Prompt explains: "the new plan you just wrote subsumes these N items. We'll add a 'Subsumes' callout on the new plan's backlog row pointing at each, replace each item's loose bullet with a brief line that names the theme and points up at the canonical entry, and leave a `<!-- consolidated <YYYY-MM-DD>: collapsed into <canonical-anchor> -->` breadcrumb. Nothing is deleted; legacy themes stay named in-place."
- Options: one per candidate item (pre-checked) plus `Apply none of these` and `Apply all`.

On approval, apply the consolidation edits using the shape from `SKILL.md` §6 step 2. Record the cluster consolidation in the closure report (Section 5 of this file).

If the plan does not actually subsume any open backlog items, skip this step silently. Do not invent overlap.

## 5. Closure Report (Appends to Stage 1 Closure)

End with a compact report:

- Plan path
- Tasks count (and how many flagged `risk: high`)
- Files touched in scope (from Pass A, top 10)
- Cluster consolidations applied (from §4b — count + subsumed item titles + canonical anchor on the new plan's backlog row). Omit if none.
- Open questions (if any)
- Next steps for the user ("review the plan, then ask me to execute task <first id> when ready")

## 6. Cost + Safety Notes

- Exactly one Opus plan per run. Never parallel.
- If Opus proposes edits outside the target plan file, reject and ask again.
- Do not kick off execution of the plan in this skill — that's a separate decision. Execution can happen in a follow-up agent turn or via another skill (e.g. manual, or a future `/execute-plan`).
- Do not commit or push. Leave the plan file untracked/unstaged so the user can review the diff.
