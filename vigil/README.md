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

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run db:push` | Push Drizzle schema to Neon |
| `npm run mcp` | MCP stdio server (see `scripts/mcp-server.mjs`) |

## Deploy on Vercel

Set `NEON_DATABASE_URL` in project environment variables. No tldraw license is required.
