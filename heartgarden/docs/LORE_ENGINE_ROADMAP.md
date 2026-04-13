---
title: Lore engine roadmap
status: canonical
audience: [agent, human]
last_reviewed: 2026-04-11
canonical: true
related:
  - heartgarden/docs/BUILD_PLAN.md
  - .cursor/plans/README.md
---

# Lore engine roadmap

**Purpose:** Single committed pointer for **lore vertical** work (import pipeline, vault index, MCP, Q&A) without relying on one missing Cursor plan file.

## Where work is tracked

1. **Repo-wide backlog and architecture snapshot:** [`docs/BUILD_PLAN.md`](./BUILD_PLAN.md) — shipped tranches, near-term hardening, lore-related items.
2. **Shipped UX + file map (import review, hgDoc pending):** [`docs/FEATURES.md`](./FEATURES.md), [`docs/EDITOR_HG_DOC.md`](./EDITOR_HG_DOC.md), [`docs/CODEMAP.md`](./CODEMAP.md) — Unreviewed/Bind, `hgAiPending`, lore import `aiReview`, palette/dock creates.
3. **Import / pipeline hardening (audit tranche):** [`.cursor/plans/data_pipeline_import_hardening.plan.md`](../../.cursor/plans/data_pipeline_import_hardening.plan.md) — maps to [`DATA_PIPELINE_AUDIT_2026-04-11.md`](./DATA_PIPELINE_AUDIT_2026-04-11.md) §10–§12.
4. **Cursor plans (workspace):** [`.cursor/plans/README.md`](../../.cursor/plans/README.md) — index of active `.plan.md` files (e.g. lore entity lab, multiplayer hardening). Add new plans there when you create them.

## Code anchors (verify before changing docs)

- Lore Q&A: `app/api/lore/query/route.ts`, `src/lib/lore-engine.ts`, `src/lib/vault-retrieval.ts`
- Lore import (plan/apply/commit): `app/api/lore/import/*`, `src/lib/lore-import-*.ts` — see [`docs/API.md`](./API.md); pending review + `entity_meta` in [`FEATURES.md`](./FEATURES.md)
- Vault index: `src/lib/item-vault-index.ts`, `POST /api/items/[itemId]/index`
- Schema: `src/db/schema.ts` (`item_embeddings`, `items` lore fields)

Do **not** duplicate env var tables here — use [`docs/VERCEL_ENV_VARS.md`](./VERCEL_ENV_VARS.md).
