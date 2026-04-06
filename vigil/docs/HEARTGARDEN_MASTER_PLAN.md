# heartgarden — documentation index

## Source of truth for **what to do next**

| Priority | Document |
|----------|----------|
| **1 — Task list & phases (lore engine + bridge + MCP expansion)** | **Cursor:** `.cursor/plans/heartgarden_lore_engine_7fc1fb56.plan.md` (YAML todos + narrative). This is the completion ledger you want agents to follow. |
| **2 — Repo snapshot & hardening backlog** | **`docs/BUILD_PLAN.md`** — architecture table, shipped tranches, near/mid/later items (lore hardening, embeddings, version history, etc.). |

## Supporting docs (not task ledgers)

| Document | Purpose |
|----------|---------|
| **`docs/FEATURES.md`** | **Shipped capabilities** → docs + code paths (collab, canvas chrome, vault UI, editing, media, boot). Start here for “where is X implemented?” |
| **`docs/CODEMAP.md`** | Subsystem → file map (canvas, sync, search, vault, lore, import, MCP). |
| **`docs/API.md`** | `app/api/**` routes (methods, purpose, secrets / env). |
| **`docs/STRATEGY.md`** | Engineering delta, phase map notes; points at BUILD_PLAN + Cursor plan. |
| **`docs/NAMING.md`** | Product name **heartgarden** vs **`vigil/`** folder; stable `vigil:*` IDs; optional folder rename checklist. |
| **`docs/FOLLOW_UP.md`** | API keys, human decisions, infra. |
| **`docs/DEPLOY_VERCEL.md`** | Vercel project setup, env vars, Neon/R2, previews, troubleshooting. |
| **`docs/DEPLOY_VERCEL_CHECKLIST.md`**, **`docs/NEON_VERCEL_SETUP.md`**, **`docs/VERCEL_ENV_VARS.md`** | Dashboard checklist; Neon prod/preview; env scope matrix. |
| **`docs/VERSIONING.md`** | App semver (`package.json`), release scripts, deploy label (`+git` on Vercel). |
| **`docs/DESIGN_SYSTEM_TOKENS.md`** | Token reference. |
| **`docs/VISUAL_REVAMP_PLAN.md`** | UI polish / revamp ideas. |
| **`docs/MIGRATION.md`**, **`docs/FUNCTIONAL_PRD_REBUILD.md`** | Historical context. |

## Archived

| Document | Location |
|----------|----------|
| Former **full** master build plan (~Phases 1–8, sessions, old paths) | **`docs/archive/vigil-master-plan-legacy.md`** — see **`docs/archive/README.md`**. |

**Agent onboarding:** `AGENTS.md` in the app directory (**`vigil/`**; **`docs/NAMING.md`** if you rename the folder).
