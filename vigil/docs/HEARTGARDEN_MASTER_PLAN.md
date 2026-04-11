---
title: heartgarden — documentation index
status: canonical
audience: [agent, human]
last_reviewed: 2026-04-11
canonical: true
related:
  - vigil/AGENTS.md
  - vigil/docs/API.md
  - vigil/docs/BUILD_PLAN.md
---

# heartgarden — documentation index

**This file is an index only** (no duplicate SoT paragraphs). **Start here for orientation**, then read **`AGENTS.md`** for depth.

## Read order

1. [`AGENTS.md`](../AGENTS.md) — product/code reality, dev guardrails, MCP, tests  
2. [`API.md`](./API.md) — HTTP contracts  
3. [`FEATURES.md`](./FEATURES.md) — shipped capabilities → code  
4. [`CODEMAP.md`](./CODEMAP.md) — subsystem → files  
5. [`BUILD_PLAN.md`](./BUILD_PLAN.md) — backlog and architecture snapshot  
6. [`VERCEL_ENV_VARS.md`](./VERCEL_ENV_VARS.md) — deploy env matrix (SoT for variable definitions)  
7. [`PLAYER_LAYER.md`](./PLAYER_LAYER.md) — GM / Players / demo tiers and collab  

## Canonical pointers

| Topic | Document |
|-------|----------|
| Lore vertical + Cursor plans index | [`LORE_ENGINE_ROADMAP.md`](./LORE_ENGINE_ROADMAP.md), [`.cursor/plans/README.md`](../../.cursor/plans/README.md) |
| Naming (`vigil/` folder) | [`NAMING.md`](./NAMING.md) |
| Engineering strategy / phase map | [`STRATEGY.md`](./STRATEGY.md) |
| Human / keys / infra | [`FOLLOW_UP.md`](./FOLLOW_UP.md) |
| Deploy (narrative) | [`DEPLOY_VERCEL.md`](./DEPLOY_VERCEL.md), [`DEPLOY_VERCEL_CHECKLIST.md`](./DEPLOY_VERCEL_CHECKLIST.md), [`NEON_VERCEL_SETUP.md`](./NEON_VERCEL_SETUP.md) |
| Versioning / design tokens / visual ideas | [`VERSIONING.md`](./VERSIONING.md), [`DESIGN_SYSTEM_TOKENS.md`](./DESIGN_SYSTEM_TOKENS.md), [`VISUAL_REVAMP_PLAN.md`](./VISUAL_REVAMP_PLAN.md) |
| DB migration notes | [`MIGRATION.md`](./MIGRATION.md) |
| Historical functional PRD | Stub [`FUNCTIONAL_PRD_REBUILD.md`](./FUNCTIONAL_PRD_REBUILD.md) → full text [`archive/FUNCTIONAL_PRD_REBUILD.md`](./archive/FUNCTIONAL_PRD_REBUILD.md) |
| Data pipeline audit (intent, modes, import, registry) | [`DATA_PIPELINE_AUDIT_2026-04-11.md`](./DATA_PIPELINE_AUDIT_2026-04-11.md) |
| Shipped capabilities + AI/import review UX | [`FEATURES.md`](./FEATURES.md), [`EDITOR_HG_DOC.md`](./EDITOR_HG_DOC.md), [`CODEMAP.md`](./CODEMAP.md) |
| Lore import canonical kind → DB / canvas | [`LORE_IMPORT_KIND_MAPPING.md`](./LORE_IMPORT_KIND_MAPPING.md) |

## Archived

| Document | Notes |
|----------|--------|
| [`archive/vigil-master-plan-legacy.md`](./archive/vigil-master-plan-legacy.md) | Long legacy product bible; dated paths |
| [`VIGIL_MASTER_PLAN.md`](./VIGIL_MASTER_PLAN.md) | Stub redirect |

## Licensing

Prefer **MIT** libraries when adding dependencies (see [`AGENTS.md`](../AGENTS.md) licensing section).
