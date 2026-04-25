---
status: backlog
audience: [agent, human]
last_reviewed: 2026-04-25T17:30:00Z
related:
  - heartgarden/drizzle/migrations/0016_backfill_spaces_brane_id.sql
  - heartgarden/src/lib/demo-brane-seed.ts
  - heartgarden/docs/REVIEW_2026-04-25_1730.md
---

# Demo brane: replace name-prefix heuristic with explicit marker

## Why

`drizzle/migrations/0016_backfill_spaces_brane_id.sql` partitions existing
spaces into branes using:

```
WHERE lower(s.name) LIKE 'demo%'
```

That moves any real GM workspace whose name starts with `demo` (e.g.
`demo-tarot-flow`, `demo run 2024`) into the demo brane silently. We did
not catch this before the migration shipped, and reverting in place is
unsafe (links + `entity_mentions` are now written assuming the current
`brane_id`).

REVIEW_2026-04-25_1730 finding M4 captures the audit context.

## Out of scope

- A blind corrective migration. Do **not** ship a migration that reshifts
  spaces unilaterally — that orphans link and mention data.

## Proposal

1. Add a marker column to `branes`:
   - `is_demo_seed boolean NOT NULL DEFAULT false` (or `seed_source text`).
   - Set `true` for the `'demo'` brane row created by the demo seed.
2. Update `src/lib/demo-brane-seed.ts` to set the marker explicitly when it
   creates / claims the demo brane row.
3. Add a GM-only admin route (e.g. `POST /api/admin/branes/reclassify`)
   that, given a space id, performs an idempotent transactional move:
   - Updates the space subtree's `brane_id`.
   - Re-scopes `entity_mentions.brane_id` for any mention whose
     `source_item_id` or `target_item_id` lives in the moved subtree.
   - Bumps revision caches for affected spaces.
4. Surface the admin route behind the existing GM break-glass gate so it
   isn't accidentally exposed.

## Acceptance

- Migration 0016's `LIKE 'demo%'` heuristic is no longer the only signal.
- A future demo seed clearly marks itself and never depends on the name.
- Admins have a documented path to recover false-positive demo spaces
  without writing raw SQL against prod.

## Risks

- Re-scoping mentions in production needs to be transactional and
  observable (log the moved row counts).
- The reclassify route is a privileged admin op — keep it behind
  GM + break-glass + audit log.
