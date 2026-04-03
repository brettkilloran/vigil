This is a [Next.js](https://nextjs.org) app: **VIGIL** — a custom DOM infinite canvas (no third-party whiteboard SDK).

## Product direction

Full spec: **`docs/VIGIL_MASTER_PLAN.md`**. Engineering bridge: **`docs/STRATEGY.md`**.

**Stack:** Next.js App Router, React, Tailwind CSS 4, zustand + immer, @use-gesture/react, framer-motion, TipTap, Drizzle + Neon.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without `NEON_DATABASE_URL`, the app runs in **local-only** mode (data in `localStorage`). With Neon configured, use **`docs/STRATEGY.md`** migration notes if upgrading from older schemas (removed `users` / `source_shape_id` / tldraw snapshots).

Copy [`.env.local.example`](.env.local.example) to `.env.local` for database and optional OpenAI/R2.

Upgrading an old Neon schema: see [`docs/MIGRATION.md`](docs/MIGRATION.md).

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Development server (**runs until stopped** — not a stuck terminal) |
| `npm run check` | `lint` + `build` (use this for quick verification; exits when done) |
| `npm run build` | Production build |
| `npm run db:push` | Push Drizzle schema to Neon |
| `npm run mcp` | MCP stdio server (see `scripts/mcp-server.mjs`; long-lived when connected) |

### Keyboard (canvas, not typing in a note)

| Keys | Action |
|------|--------|
| Arrows | Nudge selected item (Shift = larger step) |
| **Alt+Shift** + arrows | Spatial jump: select nearest item in that direction (from selection or viewport center); recenters camera on the target |
| ⌘/Ctrl+K | Command palette |
| ⌘/Ctrl+Z / ⇧⌘Z | Undo / redo |
| ⌘/Ctrl+S | Stack selection |

### “Background shell” running 20+ minutes?

That is usually **`next dev`** (or a second copy started by mistake). Stop it from the terminal trashcan / **Ctrl+C**, or run **`npm run check`** instead when you only need to validate the project.

## Deploy on Vercel

Set `NEON_DATABASE_URL` in project environment variables. No tldraw license is required.
