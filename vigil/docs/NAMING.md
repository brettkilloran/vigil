---
title: heartgarden naming vs repo paths
status: canonical
audience: [agent, human]
last_reviewed: 2026-04-11
canonical: true
related:
  - ../AGENTS.md
---

# heartgarden naming vs repo paths

**Product and package name:** **heartgarden** (UI metadata, `package.json`, Vercel project name, marketing).

**App directory in git:** **`heartgarden/`** — the Next.js app root. All commands (`npm install`, `npm run check`, Vercel **Root Directory**) use this path. If your checkout still has **`vigil/`**, rename it when nothing holds the folder open (Windows: `git mv vigil heartgarden` from the repo root).

## MCP tools

**Canonical tool names** are **`heartgarden_*`** (e.g. **`heartgarden_list_items`**, **`heartgarden_search`**), exposed by **`src/lib/mcp/heartgarden-mcp-server.ts`** and **`GET|POST|DELETE /api/mcp`**. **`vigil_*`** names are **legacy aliases**: the server still accepts them on **`tools/call`** and maps them to **`heartgarden_*`**.

## Stable technical identifiers (do not rename casually)

These stay as **`vigil…`** on purpose so existing data and integrations keep working:

- **TipTap / note links:** `vigil:item:<uuid>` (stored in `content_json` and Neon).
- **CSS design tokens:** `--vigil-*`, classes like `vigil-btn`, `data-vigil-theme` (large surface area).
- **localStorage keys:** e.g. `vigil-canvas-local-v1`, `vigil-recent-items-v2:<tier>`, `vigil-recent-folders-v2:<tier>`, `heartgarden-workspace-view-v2`, `vigil-canvas-effects-enabled`.

Renaming those requires migrations, dual-read/write, or user data loss.

Internal module/file names such as `VigilApp.tsx` or `vigil-ui-classes.ts` are legacy implementation detail; new code should prefer **heartgarden** in user-facing strings.

## Deploying

Step-by-step Vercel setup (root directory, env tables, Neon/R2, previews): **`docs/DEPLOY_VERCEL.md`**.
