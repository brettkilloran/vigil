import { drizzle } from "drizzle-orm/neon-serverless";

import * as schema from "./schema";

export { schema };

let cachedDb: ReturnType<typeof drizzle<typeof schema>> | undefined;

function postgresConnectionString(): string | undefined {
  const a = process.env.NEON_DATABASE_URL?.trim();
  const b = process.env.DATABASE_URL?.trim();
  return a || b || undefined;
}

export function tryGetDb() {
  const connectionString = postgresConnectionString();
  if (!connectionString) return undefined;
  if (!cachedDb) {
    cachedDb = drizzle(connectionString, { schema });
  }
  return cachedDb;
}

