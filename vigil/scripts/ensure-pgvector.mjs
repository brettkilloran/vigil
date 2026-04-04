/**
 * Neon: enable pgvector before `drizzle-kit push` if item_embeddings uses vector().
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
console.log("pgvector extension ready.");
