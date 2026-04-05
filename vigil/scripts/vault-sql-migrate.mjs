/**
 * Apply idempotent vault SQL after `drizzle-kit push` (indexes + NOT NULL guards).
 * Uses `pg` + NEON_DATABASE_URL from `.env.local`.
 *
 * Run: node ./scripts/vault-sql-migrate.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

config({ path: join(root, ".env.local") });

const url = process.env.NEON_DATABASE_URL?.trim();
if (!url) {
  console.error("NEON_DATABASE_URL missing (.env.local)");
  process.exit(1);
}

const sqlPath = join(root, "drizzle", "migrations", "0003_vault_embeddings_lore_meta.sql");
let sql;
try {
  sql = readFileSync(sqlPath, "utf8");
} catch {
  console.error("Missing migration file:", sqlPath);
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false },
});

await client.connect();

try {
  await client.query(sql);
  console.log("Vault SQL migration applied:", sqlPath);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  if (/hnsw|access method/i.test(msg)) {
    console.warn(
      "[vault-sql-migrate] HNSW index failed (Postgres/pgvector version). Retrying without HNSW…",
    );
    const withoutHnsw = sql.replace(/-- Approximate[\s\S]*$/m, "").trimEnd();
    try {
      await client.query(withoutHnsw);
      console.log("Vault SQL migration applied (without HNSW).");
    } catch (e2) {
      console.error(e2);
      process.exit(1);
    }
  } else {
    console.error(e);
    process.exit(1);
  }
} finally {
  await client.end();
}
