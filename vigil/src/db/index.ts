import { drizzle } from "drizzle-orm/neon-serverless";

import * as schema from "./schema";

export { schema };

let cachedDb: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function tryGetDb() {
  const connectionString = process.env.NEON_DATABASE_URL;
  if (!connectionString) return undefined;
  if (!cachedDb) {
    cachedDb = drizzle(connectionString, { schema });
  }
  return cachedDb;
}

export function getDb() {
  const db = tryGetDb();
  if (!db) {
    throw new Error(
      "Missing NEON_DATABASE_URL in .env.local (required for Phase 1 persistence).",
    );
  }
  return db;
}

