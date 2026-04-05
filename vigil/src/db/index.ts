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

