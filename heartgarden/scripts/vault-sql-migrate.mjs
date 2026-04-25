/**
 * Apply every idempotent SQL migration under `drizzle/migrations/` to Neon in order.
 *
 * This is a companion to `drizzle-kit push --force`: `push` keeps the declarative schema
 * (tables / columns / types) aligned with `src/db/schema.ts`, and this script lays down the
 * **side effects** that cannot live in the Drizzle schema file — extensions, custom indexes
 * (pgvector HNSW, trigram, FTS), data backfills, and NOT NULL tightening guarded by
 * `IF NOT EXISTS` / `DO $$` blocks.
 *
 * Every file in `drizzle/migrations/*.sql` is designed to be **re-runnable**. The script
 * executes them in lexicographic order (same order as their numeric prefixes).
 *
 * Uses `pg` + `NEON_DATABASE_URL` (or any other key `resolvePostgresUrlFromEnv` accepts)
 * from `.env.local`.
 *
 * Run: `node ./scripts/vault-sql-migrate.mjs`
 * Or:  `pnpm run db:vault-sql` (part of `pnpm run db:vault-setup`).
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

config({ path: join(root, ".env.local") });

/** Mirrors `src/db/postgres-env-url.ts`; inlined so this script stays plain Node. */
const url = [
  "NEON_DATABASE_URL",
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
]
  .map((k) => process.env[k]?.trim())
  .find((v) => v);
if (!url) {
  console.error(
    "No Postgres URL set. Provide one of NEON_DATABASE_URL, DATABASE_URL, POSTGRES_URL, or POSTGRES_PRISMA_URL."
  );
  process.exit(1);
}

const migrationsDir = join(root, "drizzle", "migrations");
const files = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.error("No .sql files found in", migrationsDir);
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false },
});

await client.connect();

try {
  for (const name of files) {
    const sqlPath = join(migrationsDir, name);
    const sql = readFileSync(sqlPath, "utf8");
    process.stdout.write(`[vault-sql-migrate] applying ${name} … `);
    try {
      await client.query(sql);
      console.log("ok");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      /**
       * pgvector HNSW is only available on Postgres builds with a new enough pgvector.
       * Strip the "Approximate nearest neighbor" block (a trailing comment header in
       * `0003_vault_embeddings_lore_meta.sql`) and retry. Everything above that block is
       * still additive.
       */
      if (/hnsw|access method/i.test(msg)) {
        console.warn(
          `\n[vault-sql-migrate] HNSW index failed in ${name} (Postgres/pgvector version). Retrying without HNSW…`
        );
        const withoutHnsw = sql
          .replace(/-- Approximate[\s\S]*$/m, "")
          .trimEnd();
        try {
          await client.query(withoutHnsw);
          console.log(`[vault-sql-migrate] ok (without HNSW): ${name}`);
        } catch (e2) {
          console.error(`[vault-sql-migrate] failed: ${name}`);
          console.error(e2);
          process.exit(1);
        }
      } else {
        console.error(`\n[vault-sql-migrate] failed: ${name}`);
        console.error(e);
        process.exit(1);
      }
    }
  }
  console.log(`[vault-sql-migrate] applied ${files.length} migration file(s).`);
} finally {
  await client.end();
}
