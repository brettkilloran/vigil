# Database migration notes (heartgarden)

The current Drizzle schema **does not** include:

- `users` or `spaces.user_id`
- `items.source_shape_id`
- tldraw document JSON in `spaces.canvas_state` (only **`{ "x", "y", "zoom" }`**)

If your Neon database was created with an older heartgarden build:

1. **Easiest for development:** drop the old tables (or create a new Neon branch) and run `pnpm run db:push` so the schema matches [`src/db/schema.ts`](../src/db/schema.ts).

2. **If you must keep data:** export what you need (e.g. JSON export from the app or SQL dump), align the schema manually, then re-import items. There is no automated migrator from tldraw snapshots to the custom canvas model.

3. **Extensions:** embeddings use `pgvector`. On Neon, enable the **pgvector** extension for the database if you use `/api/items/[id]/embed`.

See also [`STRATEGY.md`](./STRATEGY.md) and [`HEARTGARDEN_MASTER_PLAN.md`](./HEARTGARDEN_MASTER_PLAN.md).
