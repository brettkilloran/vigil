/**
 * Neon: enable extensions before `drizzle-kit push` / vault SQL.
 * - vector: chunk embeddings
 * - pg_trgm: fuzzy search (`similarity`) used when FTS has no hits — lore + search
 * Run: node ./scripts/ensure-pgvector.mjs
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });
const url = process.env.NEON_DATABASE_URL;
if (!url) {
  console.error("NEON_DATABASE_URL missing (.env.local)");
  process.exit(1);
}
const sql = neon(url);
await sql`CREATE EXTENSION IF NOT EXISTS vector`;
await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
console.log("pgvector + pg_trgm extensions ready.");
