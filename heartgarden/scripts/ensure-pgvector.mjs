/**
 * Enable extensions before `drizzle-kit push` / vault SQL.
 * - vector: chunk embeddings
 * - pg_trgm: fuzzy search (`similarity`) used when FTS has no hits — lore + search
 * Run: node ./scripts/ensure-pgvector.mjs
 */
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });

/** Mirrors `src/db/postgres-env-url.ts`; inlined so this script stays plain Node. */
const url = ["NEON_DATABASE_URL", "DATABASE_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL"]
  .map((k) => process.env[k]?.trim())
  .find((v) => v);
if (!url) {
  console.error(
    "No Postgres URL set. Provide one of NEON_DATABASE_URL, DATABASE_URL, POSTGRES_URL, or POSTGRES_PRISMA_URL.",
  );
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query("CREATE EXTENSION IF NOT EXISTS vector");
  await client.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");
  console.log("pgvector + pg_trgm extensions ready.");
} finally {
  await client.end();
}
