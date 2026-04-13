import { drizzle } from "drizzle-orm/neon-serverless";

import * as schema from "./schema";
import { resolvePostgresUrlFromEnv } from "./postgres-env-url";

export { schema };

let cachedDb: ReturnType<typeof drizzle<typeof schema>> | undefined;

function postgresConnectionString(): string | undefined {
  return resolvePostgresUrlFromEnv();
}

export function tryGetDb() {
  const connectionString = postgresConnectionString();
  if (!connectionString) return undefined;
  if (!cachedDb) {
    cachedDb = drizzle(connectionString, { schema });
  }
  return cachedDb;
}

